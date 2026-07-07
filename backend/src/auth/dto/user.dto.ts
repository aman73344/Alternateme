export interface UpdateProfileDto {
  name?: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  timezone?: string;
  language?: string;
  theme?: string;
}

export interface UpdatePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface ChangeEmailDto {
  newEmail: string;
  currentPassword: string;
}

export interface UpdatePreferencesDto {
  timezone?: string;
  language?: string;
  theme?: string;
  notificationPreferences?: Record<string, unknown>;
}

export interface AvatarUpdateDto {
  avatarUrl: string;
}

export interface DeleteAccountDto {
  currentPassword: string;
}
