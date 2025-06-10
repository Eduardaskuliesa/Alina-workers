import { Cart, CartItem } from './objects/Cart';

import { ExpiryReminder1Day } from './objects/ExpiryReminder1Day';
import { ExpiryData, ExpiryReminder7Day } from './objects/ExpiryReminder7Day';
export { Cart };

export { ExpiryReminder7Day };
export { ExpiryReminder1Day };

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		const corsHeaders = {
			'Access-Control-Allow-Origin': 'http://localhost:3000',
			'Content-Type': 'application/json',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': 'http://localhost:3000',
					'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS, PUT',
					'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
				},
			});
		}

		if (url.pathname === '/health') {
			return new Response('Cart Worker is healthy!');
		}

		const apiKey = request.headers.get('x-api-key');
		if (!apiKey || apiKey !== env.API_KEY) {
			console.log(request.headers);
			console.log('Unauthorized access attempt with API key:', apiKey);
			console.log('Expected API key:', env.API_KEY);
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: corsHeaders,
			});
		}

		const userId = url.searchParams.get('userId');

		if (!userId) {
			return new Response(JSON.stringify({ error: 'Missing userId parameter' }), {
				status: 400,
				headers: corsHeaders,
			});
		}

		const cartId = env.CART.idFromName(`user-${userId}`);
		const cart = env.CART.get(cartId);

		try {
			if (url.pathname === '/cart/add' && request.method === 'POST') {
				const item: CartItem = await request.json();
				const result = await cart.addToCart(item);

				return new Response(JSON.stringify({ success: true, message: result }), {
					headers: corsHeaders,
				});
			}

			if (url.pathname === '/cart/remove' && request.method === 'DELETE') {
				const { courseId } = (await request.json()) as { courseId: string };
				const result = await cart.removeFromCart(courseId);

				return new Response(JSON.stringify({ success: true, message: result }), {
					headers: corsHeaders,
				});
			}

			if (url.pathname === '/cart/update-item' && request.method === 'PUT') {
				const { courseId, updates } = (await request.json()) as { courseId: string; updates: Partial<CartItem> };
				const result = await cart.updateCart(courseId, updates);

				return new Response(JSON.stringify({ success: true, message: result }), {
					headers: corsHeaders,
				});
			}

			if (url.pathname === '/cart' && request.method === 'GET') {
				const cartItems = await cart.getCart();

				return new Response(JSON.stringify({ success: true, cart: cartItems }), {
					headers: corsHeaders,
				});
			}

			if (url.pathname === '/cart/clear' && request.method === 'POST') {
				const result = await cart.clearCart();

				return new Response(JSON.stringify({ success: true, message: result }), {
					headers: corsHeaders,
				});
			}

			if (url.pathname === '/cart/reset-reminder' && request.method === 'POST') {
				const result = await cart.resetCartReminder();

				return new Response(JSON.stringify({ success: true, message: result }), {
					headers: corsHeaders,
				});
			}

			if (url.pathname === '/schedule-expiry-7days' && request.method === 'POST') {
				try {
					const requestBody = await request.json();

					const expiryData = requestBody as { userId: string; courseId: string; expiresAt: string };
					const reminderId = env.EXPIRY_7DAY.idFromName(`${expiryData.userId}-${expiryData.courseId}`);
					const reminder = env.EXPIRY_7DAY.get(reminderId);

					const result = await reminder.scheduleReminder(expiryData as ExpiryData);

					return new Response(JSON.stringify({ success: true, message: result }), {
						headers: corsHeaders,
					});
				} catch (error) {
					console.error('Worker error:', error);
					return new Response(JSON.stringify({ error: error }), {
						status: 500,
						headers: corsHeaders,
					});
				}
			}

			if (url.pathname === '/schedule-expiry-1day' && request.method === 'POST') {
				const requestBody = await request.json();

				const expiryData = requestBody as { userId: string; courseId: string; expiresAt: string };
				const reminderId = env.EXPIRY_1DAY.idFromName(`${expiryData.userId}-${expiryData.courseId}`);
				const reminder = env.EXPIRY_1DAY.get(reminderId);

				const result = await reminder.scheduleReminder(expiryData as ExpiryData);
				return new Response(JSON.stringify({ success: true, message: result }), {
					headers: corsHeaders,
				});
			}

			return new Response(JSON.stringify({ error: 'Route not found' }), {
				status: 404,
				headers: corsHeaders,
			});
		} catch (error) {
			return new Response(
				JSON.stringify({
					success: false,
					error: error || 'Internal server error',
				}),
				{
					status: 500,
					headers: corsHeaders,
				}
			);
		}
	},
} satisfies ExportedHandler<Env>;
