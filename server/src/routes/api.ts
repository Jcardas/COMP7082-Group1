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
  acceptFriendRequest,
  acceptModpackInvite,
  addModToModpack,
  commentOnMod,
  createModpack,
  declineFriendRequest,
  declineModpackInvite,
  deleteAccount,
  deleteFriend,
  deleteModpack,
  getHealth,
  getModpackById,
  inviteCollaboratorToModpack,
  listFriendRequests,
  listFriends,
  listModpackInvites,
  listModpacks,
  removeModFromModpack,
  sendFriendRequest,
  serveUploadedFile,
  syncUser,
  updateModpack,
  uploadImage,
  voteOnMod,
} from '../controllers/modpackController.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  addFriendSchema,
  addModSchema,
  analyzeDependenciesBodySchema,
  commentModSchema,
  createModpackSchema,
  deleteAccountSchema,
  exportModpackBodySchema,
  inviteCollaboratorSchema,
  modDependenciesQuerySchema,
  recommendationsBodySchema,
  resolveModDependenciesBodySchema,
  respondFriendRequestSchema,
  respondInviteSchema,
  searchQuerySchema,
  syncUserSchema,
  updateModpackSchema,
  uploadImageSchema,
  voteModSchema,
} from '../schemas/modpackSchemas.js';

export const apiRouter = Router();

// 1. Health & Status Check
apiRouter.get('/health', getHealth);

// 2. User Sync, Account Deletion, and File Uploads
apiRouter.post('/users/sync', validateBody(syncUserSchema), syncUser);
apiRouter.delete('/account', validateBody(deleteAccountSchema), deleteAccount);
apiRouter.post('/upload', validateBody(uploadImageSchema), uploadImage);
apiRouter.get('/uploads/:filename', serveUploadedFile);

// 3. Mod Search, Recommendations & Dependency Analysis (ModController)
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

// 4. Modpack CRUD & Collaborative Actions (ModpackController)
apiRouter.get('/modpacks', listModpacks);
apiRouter.post('/modpacks', validateBody(createModpackSchema), createModpack);
apiRouter.get('/modpacks/:id', getModpackById);
apiRouter.patch('/modpacks/:id', validateBody(updateModpackSchema), updateModpack);
apiRouter.delete('/modpacks/:id', deleteModpack);

apiRouter.post('/modpacks/:id/mods', validateBody(addModSchema), addModToModpack);
apiRouter.delete('/modpacks/:id/mods/:modId', removeModFromModpack);
apiRouter.post('/modpacks/:id/mods/:modId/vote', validateBody(voteModSchema), voteOnMod);
apiRouter.post(
  '/modpacks/:id/mods/:modId/comments',
  validateBody(commentModSchema),
  commentOnMod
);

// 5. Collaborator Invitations (Invite -> Accept / Decline -> Permanent Collaborator)
apiRouter.post(
  '/modpacks/:id/invites',
  validateBody(inviteCollaboratorSchema),
  inviteCollaboratorToModpack
);
apiRouter.get('/invites', listModpackInvites);
apiRouter.post(
  '/invites/:inviteId/accept',
  validateBody(respondInviteSchema),
  acceptModpackInvite
);
apiRouter.post(
  '/invites/:inviteId/decline',
  validateBody(respondInviteSchema),
  declineModpackInvite
);

// 6. Modpack Zip / .mrpack Archive Export (ExportController)
apiRouter.post('/modpacks/:id/export', validateBody(exportModpackBodySchema), exportModpack);

// 7. Collaborator Friends & Friend Request Endpoints (ModpackController)
apiRouter.get('/friends', listFriends);
apiRouter.post('/friends', validateBody(addFriendSchema), sendFriendRequest);
apiRouter.delete('/friends/:id', deleteFriend);

apiRouter.get('/friend-requests', listFriendRequests);
apiRouter.post('/friends/requests', validateBody(addFriendSchema), sendFriendRequest);
apiRouter.post(
  '/friend-requests/:id/accept',
  validateBody(respondFriendRequestSchema),
  acceptFriendRequest
);
apiRouter.post(
  '/friend-requests/:id/decline',
  validateBody(respondFriendRequestSchema),
  declineFriendRequest
);

export default apiRouter;
