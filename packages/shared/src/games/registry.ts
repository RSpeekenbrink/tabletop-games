/**
 * GameDescriptor is the public identity of a game. Both server and client
 * consume this to populate UI and to look up modules in their own registries.
 *
 * Each registered game lives under packages/{server,client}/src/games/<id>/
 * and exposes its own module shape (server logic vs. client component).
 */
export interface GameDescriptor {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  description?: string;
}
