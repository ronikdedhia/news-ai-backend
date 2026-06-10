import { db } from '../db/client';
import { userPreferences, NewUserPreference, UserPreference, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

export interface UserPreferencesData {
  preferredCategories: string[]; // Array of 3 categories
  preferredLanguage: 'english' | 'hindi' | 'marathi' | 'gujarati' | 'tamil' | 'spanish' | 'french' | 'german';
  fontSize: 'small' | 'medium' | 'large';
  theme: 'light' | 'dark';
  notificationsEnabled: boolean;
  emailDigestFrequency: 'daily' | 'weekly' | 'never';
}

export class UserPreferencesService {
  async createUserPreferences(userId: string, preferences: UserPreferencesData): Promise<UserPreference> {
    try {
      // Validate categories count
      if (!preferences.preferredCategories || preferences.preferredCategories.length !== 3) {
        throw new Error('Must select exactly 3 categories');
      }

      // Check if user exists first
      const userExists = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userExists.length === 0) {
        throw new Error(`User with ID ${userId} does not exist`);
      }

      // Check if preferences already exist for this user
      const existingPrefs = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      if (existingPrefs.length > 0) {
        throw new Error('User preferences already exist. Use update instead.');
      }

      const newPreference: NewUserPreference = {
        id: crypto.randomUUID(),
        userId,
        preferredCategories: JSON.stringify(preferences.preferredCategories),
        preferredLanguage: preferences.preferredLanguage,
        fontSize: preferences.fontSize,
        theme: preferences.theme,
        notificationsEnabled: preferences.notificationsEnabled ? 1 : 0,
        emailDigestFrequency: preferences.emailDigestFrequency,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const created = await db.insert(userPreferences).values(newPreference).returning();
      logger.info(`✅ User preferences created for user: ${userId}`);
      return created[0];
    } catch (error: any) {
      logger.error('Error creating user preferences:', error);
      throw error;
    }
  }

  async getUserPreferences(userId: string): Promise<UserPreference | null> {
    try {
      const prefs = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      return prefs.length > 0 ? prefs[0] : null;
    } catch (error: any) {
      logger.error('Error fetching user preferences:', error);
      throw error;
    }
  }

  async updateUserPreferences(userId: string, preferences: Partial<UserPreferencesData>): Promise<UserPreference> {
    try {
      const updateData: any = {
        updatedAt: new Date().toISOString(),
      };

      if (preferences.preferredCategories) {
        if (preferences.preferredCategories.length !== 3) {
          throw new Error('Must select exactly 3 categories');
        }
        updateData.preferredCategories = JSON.stringify(preferences.preferredCategories);
      }

      if (preferences.preferredLanguage) {
        updateData.preferredLanguage = preferences.preferredLanguage;
      }

      if (preferences.fontSize) {
        updateData.fontSize = preferences.fontSize;
      }

      if (preferences.theme) {
        updateData.theme = preferences.theme;
      }

      if (preferences.notificationsEnabled !== undefined) {
        updateData.notificationsEnabled = preferences.notificationsEnabled ? 1 : 0;
      }

      if (preferences.emailDigestFrequency) {
        updateData.emailDigestFrequency = preferences.emailDigestFrequency;
      }

      const updated = await db
        .update(userPreferences)
        .set(updateData)
        .where(eq(userPreferences.userId, userId))
        .returning();

      if (updated.length === 0) {
        throw new Error('User preferences not found');
      }

      logger.info(`✅ User preferences updated for user: ${userId}`);
      return updated[0];
    } catch (error: any) {
      logger.error('Error updating user preferences:', error);
      throw error;
    }
  }
}

export const userPreferencesService = new UserPreferencesService();
