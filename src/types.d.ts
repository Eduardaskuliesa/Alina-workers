import { Cart } from './objects/Cart';
import { WhishList } from './objects/WhishList';

interface Env {
	CART: DurableObjectNamespace<Cart>;
	WHISHLIST: DurableObjectNamespace<WhishList>;
	NEXTJS_APP_URL: string;
	NEXTJS_APP_API_SECRET: string;
}

declare global {
	interface CloudflareEnv extends Env {}
}
