import type { Express, Request, Response } from "express";

export interface MockFolder {
  id: string;
  label: string;
  badge?: number;
}

const folders: MockFolder[] = [
  { id: "1", label: "Папка 1", badge: 4 },
  { id: "2", label: "Папка 2" },
  { id: "3", label: "Папка 3", badge: 4 },
];

export function registerFoldersRoutes(app: Express, apiBase: string) {
  app.get(`${apiBase}/folders`, (_req: Request, res: Response) => {
    res.json({ folders });
  });
}
