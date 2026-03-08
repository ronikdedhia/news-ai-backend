import { db } from '../db/client';
import { users, NewUser, User } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { userPreferencesService, UserPreferencesData } from './user-preferences.service';

export class UserService {
  async createOrUpdateUser(userData: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
    preferences?: UserPreferencesData;
  }): Promise<User> {
    try {
      // Check if user exists by ID
      let existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userData.id))
        .limit(1);

      if (existingUser.length > 0) {
        // Update existing user (don't change ID due to foreign keys)
        const updated = await db
          .update(users)
          .set({
            email: userData.email || existingUser[0].email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(users.id, userData.id))
          .returning();

        return updated[0];
      }

      // Create new user - email is required for new users
      if (!userData.email) {
        throw new Error('Email is required to create a new user');
      }

      const newUser: NewUser = {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        isPremium: 0,
        articlesViewedCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const created = await db.insert(users).values(newUser).returning();
      logger.info(`✅ New user created: ${userData.email}`);

      // Create user preferences if provided
      if (userData.preferences) {
        await userPreferencesService.createUserPreferences(userData.id, userData.preferences);
      }

      return created[0];
    } catch (error: any) {
      logger.error('Error creating/updating user:', error);
      throw error;
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return user.length > 0 ? user[0] : null;
    } catch (error: any) {
      logger.error('Error fetching user:', error);
      throw error;
    }
  }

  async incrementArticlesViewed(userId: string): Promise<void> {
    try {
      const user = await this.getUserById(userId);
      if (!user) return;

      await db
        .update(users)
        .set({
          articlesViewedCount: user.articlesViewedCount + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId));
    } catch (error: any) {
      logger.error('Error incrementing articles viewed:', error);
    }
  }

  async upgradeToPremium(userId: string): Promise<User> {
    try {
      const updated = await db
        .update(users)
        .set({
          isPremium: 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, userId))
        .returning();

      logger.info(`✅ User upgraded to premium: ${userId}`);
      return updated[0];
    } catch (error: any) {
      logger.error('Error upgrading user:', error);
      throw error;
    }
  }
}

export const userService = new UserService();
