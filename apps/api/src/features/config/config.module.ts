import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EnvironmentModule } from "environment/environment.module";
import { ConfigController } from "features/config/config.controller";
import { ConfigRepository } from "features/config/config.repository";
import { ConfigService } from "features/config/config.service";
import { CryptoModule } from "features/crypto/crypto.module";
import { UsersModule } from "plugins/user/features/users/users.module";
import { Config, ConfigSchema } from "schemas/config.schema";

@Module({
  imports: [
    EnvironmentModule,
    UsersModule,
    CryptoModule,
    MongooseModule.forFeature([
      { name: Config.name, schema: ConfigSchema },
    ]),
  ],
  controllers: [ConfigController],
  exports: [ConfigService],
  providers: [ConfigService, ConfigRepository],
})
export class ConfigModule { }
