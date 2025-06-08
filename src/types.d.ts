import { Cart } from './objects/Cart';

interface Env {
	CART: DurableObjectNamespace<Cart>;
	NEXTJS_APP_URL: string;
	NEXTJS_APP_API_SECRET: string;
}

declare global {
	interface CloudflareEnv extends Env {}
}
