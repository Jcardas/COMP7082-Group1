// server/src/routes/api.ts
// Declarative REST API router binding HTTP verbs and paths
// to Zod validation middleware and controller handlers.

import { Router } from 'express';
import { exportModpack } from '../controllers/exportController.js';
import {
  analyzeModDependencies,
  getModDependencies,
  getRecommendations,
  resolveModDependencies,
  searchMods,
} from '../controllers/modController.js';
import {
  addFriend,
  addModToModpack,
  commentOnMod,
  createModpack,
  deleteFriend,
  deleteModpack,
  getHealth,
  getModpackById,
  listFriends,
  listModpacks,
  updateModpack,
  voteOnMod,
} from '../controllers/modpackController.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  addFriendSchema,
  addModSchema,
  analyzeDependenciesBodySchema,
  commentModSchema,
  createModpackSchema,
  exportModpackBodySchema,
  modDependenciesQuerySchema,
  recommendationsBodySchema,
  resolveModDependenciesBodySchema,
  searchQuerySchema,
  updateModpackSchema,
  voteModSchema,
} from '../schemas/modpackSchemas.js';

export const apiRouter = Router();

// 1. Health & Status Check
apiRouter.get('/health', getHealth);

// 2. Mod Search, Recommendations & Dependency Analysis (ModController)
apiRouter.get('/search', validateQuery(searchQuerySchema), searchMods);
apiRouter.post('/recommendations', validateBody(recommendationsBodySchema), getRecommendations);
apiRouter.post(
  '/resolve-mod-dependencies',
  validateBody(resolveModDependenciesBodySchema),
  resolveModDependencies
);
apiRouter.post(
  '/analyze-dependencies',
  validateBody(analyzeDependenciesBodySchema),
  analyzeModDependencies
);
apiRouter.get(
  '/mods/:id/dependencies',
  validateQuery(modDependenciesQuerySchema),
  getModDependencies
);

// 3. Modpack CRUD & Collaborative Actions (ModpackController)
apiRouter.get('/modpacks', listModpacks);
apiRouter.post('/modpacks', validateBody(createModpackSchema), createModpack);
apiRouter.get('/modpacks/:id', getModpackById);
apiRouter.patch('/modpacks/:id', validateBody(updateModpackSchema), updateModpack);
apiRouter.delete('/modpacks/:id', deleteModpack);

apiRouter.post('/modpacks/:id/mods', validateBody(addModSchema), addModToModpack);
apiRouter.post('/modpacks/:id/mods/:modId/vote', validateBody(voteModSchema), voteOnMod);
apiRouter.post(
  '/modpacks/:id/mods/:modId/comments',
  validateBody(commentModSchema),
  commentOnMod
);

// 4. Modpack Zip / .mrpack Archive Export (ExportController)
apiRouter.post('/modpacks/:id/export', validateBody(exportModpackBodySchema), exportModpack);

// 5. Collaborator Friends Endpoints (ModpackController)
apiRouter.get('/friends', listFriends);
apiRouter.post('/friends', validateBody(addFriendSchema), addFriend);
apiRouter.delete('/friends/:id', deleteFriend);

export default apiRouter;
