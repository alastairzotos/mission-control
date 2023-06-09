import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IConfig } from 'models';

@Schema({ collection: 'config' })
export class Config implements IConfig {
  @Prop()
  ownerId: string;
  
  @Prop()
  githubUsername: string;

  @Prop()
  githubToken: string;
}

export const ConfigSchema = SchemaFactory.createForClass(Config);
