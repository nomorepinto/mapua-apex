import { Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementRepository } from './announcement.repository.js';

export interface AnnouncementView {
  sent_at: string;
  content: string;
}

@Injectable()
export class AnnouncementService {
  constructor(private readonly announcements: AnnouncementRepository) {}

  async list(): Promise<AnnouncementView[]> {
    const items = await this.announcements.list();
    return items.map((item) => this.toView(item));
  }

  async create(content: string): Promise<AnnouncementView> {
    return this.toView(await this.announcements.create(content));
  }

  async update(sentAt: string, content: string): Promise<AnnouncementView> {
    const existing = await this.announcements.get(decodeURIComponent(sentAt));
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    return this.toView(
      await this.announcements.update(String(existing.SK), content),
    );
  }

  async remove(sentAt: string): Promise<void> {
    const key = decodeURIComponent(sentAt);
    const existing = await this.announcements.get(key);
    if (!existing) {
      throw new NotFoundException('Not Found');
    }
    await this.announcements.delete(key);
  }

  private toView(item: { SK?: unknown; content?: unknown }): AnnouncementView {
    return { sent_at: String(item.SK), content: String(item.content ?? '') };
  }
}
