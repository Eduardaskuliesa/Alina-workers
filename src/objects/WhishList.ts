import { DurableObject } from 'cloudflare:workers';

export interface WhishListItem {
	courseId: string;
	slug: string;
	title: string;
	userId: string;
	price: number;
	language: string;
	imageUrl: string;
	duration: number;
	lessonCount: number;
	accessDuration: number;
	accessPlanId: string;
}

export class WhishList extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async getWhishLists(): Promise<WhishListItem[]> {
		const whishListItems: WhishListItem[] = (await this.ctx.storage.get<WhishListItem[]>('whishListItems')) || [];
		console.log('Whishlist items retrieved:', whishListItems.length);

		console.log('Whishlist items:', whishListItems);
		return whishListItems;
	}

	async addToWhishList(item: WhishListItem): Promise<string> {
		const whishListItems: WhishListItem[] = (await this.ctx.storage.get<WhishListItem[]>('whishListItems')) || [];
		console.log('Whishlist items before adding:', whishListItems.length);

		const exist = whishListItems.find((whishListItem) => whishListItem.courseId === item.courseId);
		if (exist) {
			return `Item already exists in the whishlist`;
		}

		whishListItems.push(item);
		await this.ctx.storage.put('whishListItems', whishListItems);
		console.log('Whishlist items after adding:', whishListItems.length);

		return `Item ${item.title} added to whishlist successfully`;
	}

	async removeFromWhishList(courseId: string): Promise<string> {
		const whishListItems: WhishListItem[] = (await this.ctx.storage.get<WhishListItem[]>('whishListItems')) || [];
		console.log('Whishlist items before removal:', whishListItems.length);
		const updated = whishListItems.filter((item) => item.courseId !== courseId);

		await this.ctx.storage.put('whishListItems', updated);
		console.log('Whishlist items after removal:', updated.length);

		return 'Item removed from whishlist';
	}

	async updateWhishList(courseId: string, updates: Partial<WhishListItem>): Promise<string> {
		const whishListItems: WhishListItem[] = (await this.ctx.storage.get<WhishListItem[]>('whishListItems')) || [];

		const item = whishListItems.find((whishListItem) => whishListItem.courseId === courseId);
		console.log('Old whishlist Item:', item);
		if (item) {
			Object.assign(item, updates);
			console.log('Updated whishlist Item:', item);
			await this.ctx.storage.put('whishListItems', whishListItems);

			return `Item ${courseId} updated successfully`;
		}

		return `Item ${courseId} not found in whishlist`;
	}
}
