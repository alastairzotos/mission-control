import { Injectable } from "@nestjs/common";
import { ConfigService } from "features/config/config.service";
import { CryptoService } from "features/crypto/crypto.service";
import { ProjectsService } from "features/projects/projects.service";
import { GitService } from "integrations/git/git.service";
import { HelmService } from "integrations/helm/helm.service";
import { IConfig, IProject, deployMessage } from "models";
import { modifyRecord } from "utils";
import { WebSocketChannel, WebSocketManager } from "utils/ws";

const { status, phase, text, progress } = deployMessage;

type IDeployResponse = "not-found" | "error" | null;

@Injectable()
export class DeployService {
  private wsManager = new WebSocketManager(3004);

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly gitService: GitService,
    private readonly helmService: HelmService,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) { }

  async uninstallProject(ownerId: string, projectId: string): Promise<true | "not-found"> {
    const config = await this.configService.getInternal(ownerId);
    if (!config) {
      return "not-found";
    }

    const project = await this.projectsService.getByIdAndOwner(projectId, ownerId);

    if (!project) {
      return "not-found";
    }

    await this.helmService.uninstall(project);
    return true;
  }

  async deployProject(ownerId: string, projectName: string): Promise<IDeployResponse> {
    const config = await this.configService.getInternal(ownerId);
    if (!config) {
      return "not-found";
    }

    const ws = this.wsManager.getChannel(projectName);
    const project = await this.projectsService.getByOwnerIdAndNameWithSecrets(ownerId, projectName);

    if (!project) {
      return "not-found";
    }

    ws.sendMessage(status("started"));

    let helmRepo: string;

    const tag = await this.getTag(ws, config, project);
    helmRepo = await this.pullHelmRepo(ws, config, project);

    if (helmRepo) {
      try {
        await this.deploy(ws, project, helmRepo, tag);
        await this.cleanup(ws, helmRepo);

        ws.sendMessage(status("finished"));
      } catch (e) {
        ws.sendMessage(text(e?.message || e));
        ws.sendMessage(status("error"));

        await this.cleanup(ws, helmRepo);
        return "error";
      }
    } else {
      ws.sendMessage(text("Unauthorised pull of helm repo"));
      ws.sendMessage(status("error"));
      return "error";
    }

    return null;
  }

  async deploy(ws: WebSocketChannel, project: IProject, helmRepo: string, tag: string) {
    ws.sendMessage(phase("deploying"))

    const secrets = modifyRecord(project.secrets || {}, secret => this.cryptoService.decrypt(secret));

    const hiddenSecrets = Object.keys(secrets)
      .reduce((acc, cur) => ({ ...acc, [cur]: '****' }), {} as Record<string, string>);

    const args = this.helmService.generateHelmArgs(
      project,
      "<ROOT_PATH>",
      tag,
      hiddenSecrets
    );

    ws.sendMessage(text(['helm', ...args.map(arg => arg.join(' '))].join('\n')));
    await this.helmService.deploy(project, secrets, helmRepo, tag, message => ws.sendMessage(text(message)));
  }

  async getTag(ws: WebSocketChannel, config: IConfig, project: IProject) {
    ws.sendMessage(phase("getting-tag"));

    const gitInfo = await this.gitService.getRemoteInfo(project.repoUrl, config.githubUsername, config.githubToken);
    const tags = Object.keys(gitInfo.refs.tags);
    const latestTag = tags[tags.length - 1];

    ws.sendMessage(text(`Aquired tag ${latestTag}`));

    return latestTag;
  }

  async pullHelmRepo(ws: WebSocketChannel, config: IConfig, project: IProject) {
    ws.sendMessage(phase("pulling-helm-repo"))

    let lastPhase = '';
    const projName = await this.gitService.clone(
      project.helmRepoUrl,
      config.githubUsername,
      config.githubToken,
      (phase, percent) => {
        if (percent !== undefined) {
          ws.sendMessage(progress(phase, percent, phase === lastPhase));
        } else {
          ws.sendMessage(text(phase, lastPhase === phase));
        }

        lastPhase = phase;
      },
    );

    return projName;
  }

  async cleanup(ws: WebSocketChannel, helmRepo: string) {
    ws.sendMessage(phase("cleaning-up"));

    ws.sendMessage(text("Removing helm repository"));
    await this.gitService.clearClonedDir(helmRepo);
  }
}
