import { secretHitlerDescriptor } from "@tabletop-games/shared";
import { registerGame } from "../registry.js";
import { SecretHitlerInstance } from "./game.js";

registerGame({
  descriptor: secretHitlerDescriptor,
  create: (room) => new SecretHitlerInstance(room),
});
