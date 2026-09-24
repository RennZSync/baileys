import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { makeCommunitiesSocket } from './communities.js';
import { createAnchorGuard } from '../Utils/anchor-guard.js';
// export the last socket layer
const makeWASocket = (config) => {
    const { AnchorGuard, AnchorGuardConfig, ...rest } = config || {};
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...rest
    };
    const sock = makeCommunitiesSocket(newConfig);
    if (AnchorGuard) {
        sock.anchorGuard = createAnchorGuard(sock, AnchorGuardConfig || {});
    }
    return sock;
};
export default makeWASocket;
//# sourceMappingURL=index.js.map