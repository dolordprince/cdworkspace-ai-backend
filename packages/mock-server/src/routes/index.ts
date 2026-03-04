import type { Express } from "express";
import { registerUsersRoutes } from "./users";
import { registerStreamsRoutes } from "./streams";
import { registerMessagesRoutes } from "./messages";
import { getTopicsByStream } from "./messages";
import { registerFoldersRoutes } from "./folders";

export function registerApiRoutes(app: Express) {
  const apiBase = "/api/v1";

  registerUsersRoutes(app, apiBase);
  registerStreamsRoutes(app, apiBase, getTopicsByStream);
  registerMessagesRoutes(app, apiBase);
  registerFoldersRoutes(app, apiBase);
}

