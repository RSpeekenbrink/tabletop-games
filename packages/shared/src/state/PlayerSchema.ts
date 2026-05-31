import { Schema, type } from "@colyseus/schema";

export class PlayerSchema extends Schema {
  @type("string") sessionId: string = "";
  @type("string") username: string = "";
  @type("boolean") connected: boolean = true;
}
