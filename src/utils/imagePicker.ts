import * as ImagePicker from 'expo-image-picker';
import {Alert, Linking, Platform} from 'react-native';

export type PickedImage = {
  uri: string;
  base64?: string | null;
};

type MediaLibraryPermission = Awaited<
  ReturnType<typeof ImagePicker.requestMediaLibraryPermissionsAsync>
>;

function buildImageLibraryOptions(multiple: boolean): ImagePicker.ImagePickerOptions {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: multiple ? 0.85 : 0.8,
    allowsMultipleSelection: multiple,
    selectionLimit: 0,
  };

  if (multiple) {
    options.allowsEditing = false;
  } else {
    options.base64 = true;
    options.allowsEditing = Platform.OS === 'ios';
  }

  if (Platform.OS === 'android') {
    options.legacy = true;
    options.allowsEditing = false;
    options.defaultTab = 'albums';
  }

  if (Platform.OS === 'ios') {
    options.shouldDownloadFromNetwork = true;
  }

  return options;
}

async function offerLimitedLibraryExpansion(): Promise<void> {
  try {
    const MediaLibrary = await import('expo-media-library');
    await MediaLibrary.presentPermissionsPicker(['photo']);
  } catch (error) {
    console.warn('[imagePicker] presentPermissionsPicker failed', error);
  }
}

async function ensureMediaLibraryReadAccess(): Promise<MediaLibraryPermission | null> {
  let permission = await ImagePicker.getMediaLibraryPermissionsAsync(false);

  if (!permission.granted) {
    permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false);
  }

  if (!permission.granted) {
    Alert.alert(
      'صلاحية الصور مطلوبة',
      'اسمح للتطبيق بالوصول إلى معرض الصور لاختيار صور الاستديو.',
      [
        {text: 'إلغاء', style: 'cancel'},
        {
          text: 'الإعدادات',
          onPress: () => {
            void Linking.openSettings();
          },
        },
      ],
    );
    return null;
  }

  if (permission.accessPrivileges === 'limited') {
    await offerLimitedLibraryExpansion();
  }

  return permission;
}

export async function pickImage(): Promise<PickedImage | null> {
  const permission = await ensureMediaLibraryReadAccess();
  if (!permission) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync(buildImageLibraryOptions(false));

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    base64: asset.base64,
  };
}

export async function pickMultipleImages(): Promise<PickedImage[]> {
  const permission = await ensureMediaLibraryReadAccess();
  if (!permission) {
    return [];
  }

  const result = await ImagePicker.launchImageLibraryAsync(buildImageLibraryOptions(true));

  if (result.canceled) {
    return [];
  }

  return result.assets.map((asset) => ({
    uri: asset.uri,
    base64: asset.base64,
  }));
}
