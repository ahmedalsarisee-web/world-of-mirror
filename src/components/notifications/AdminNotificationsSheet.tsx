import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, InteractionManager, Pressable, StyleSheet, Text, View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import BottomSheet from '@app/components/common/BottomSheet';
import EmptyState from '@app/components/common/EmptyState';
import AppButton from '@app/components/common/AppButton';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {clearSharedNotificationEvents} from '@app/services/adminNotificationEvents.service';
import {useAdminNotificationsList} from '@app/hooks/useAdminNotificationsList';
import {useAuthStore} from '@app/stores/authStore';
import {
  type AdminNotificationRecord,
  useAdminNotificationStore,
} from '@app/stores/adminNotificationStore';
import {canClearSharedNotificationsLog} from '@app/utils/adminPermissions';
import {getAdminNotificationPresentation} from '@app/utils/adminNotificationPresentation';
import {formatAdminNotificationTimestamp} from '@app/utils/formatAdminNotificationTimestamp';
import {navigateFromAdminNotification} from '@app/utils/adminNotificationNavigation';
import {
  captureAdminNotificationDestinationRoute,
  isStandaloneOrderAdminNotificationKind,
} from '@app/utils/adminNotificationSheetReturn';
import {useAdminNotificationsUiStore} from '@app/stores/adminNotificationsUiStore';
import {getListCardStyle} from '@shared/theme/themeHelpers';
import AdminNotificationBodyText from '@app/components/notifications/AdminNotificationBodyText';
import {resolveAdminNotificationActorName} from '@app/utils/adminNotificationActorHighlight';
import {
  clearAdminNotificationListCache,
  getAdminNotificationListCacheEvents,
} from '@app/utils/adminNotificationListCache';
import {stopAdminNotificationsNewerListener} from '@app/utils/adminNotificationRealtime';
import {markAdminNotificationsRead} from '@app/utils/adminNotificationReadState';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const AdminNotificationsSheet: React.FC<Props> = ({visible, onClose}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, chevronForward} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
  const currentUser = useAuthStore((state) => state.user);
  const authEmail = useAuthStore((state) => state.authEmail);
  const markRead = useAdminNotificationStore((state) => state.markRead);
  const markAllRead = useAdminNotificationStore((state) => state.markAllRead);
  const resetLocalLog = useAdminNotificationStore((state) => state.resetLocalLog);
  const canClearSharedLog = canClearSharedNotificationsLog(currentUser, authEmail);
  const [clearing, setClearing] = useState(false);
  const {displayItems, loadingInitial, loadingMore, hasMore, loadMore} = useAdminNotificationsList(visible);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        sheetBody: {gap: theme.spacing.sm, paddingBottom: theme.spacing.md},
        sheetBodyFlex: {flex: 1, minHeight: 0},
        toolbarHint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
          color: theme.typography.muted,
          marginBottom: theme.spacing.xs,
        },
        card: {
          ...listCard,
          overflow: 'hidden',
          paddingVertical: theme.spacing.sm,
          paddingEnd: theme.spacing.sm,
          paddingStart: theme.spacing.md,
        },
        cardUnread: {
          backgroundColor: theme.colors.surfaceSecondary,
        },
        accentBar: {
          position: 'absolute',
          start: 0,
          top: 0,
          bottom: 0,
          width: 3,
        },
        cardInner: {
          flex: 1,
          minWidth: 0,
          gap: theme.spacing.xs,
        },
        cardHeader: {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.xs,
        },
        iconWrap: {
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        category: {
          flex: 1,
          fontSize: 11,
          fontWeight: '600',
          lineHeight: 14,
        },
        headerTime: {
          fontSize: 11,
          lineHeight: 14,
          color: theme.typography.muted,
          flexShrink: 0,
        },
        title: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
          lineHeight: 20,
        },
        body: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
          color: theme.typography.secondary,
        },
        footerRow: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          marginTop: 2,
        },
        footerHint: {
          fontSize: 11,
          lineHeight: 14,
          color: theme.typography.muted,
        },
        listContent: {
          paddingBottom: theme.spacing.sm,
        },
        itemSeparator: {
          height: theme.spacing.sm,
        },
        list: {flex: 1, minHeight: 0},
        loadMoreButton: {alignItems: 'center', paddingVertical: theme.spacing.md},
        loadMoreText: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
        },
        loadingWrap: {paddingVertical: theme.spacing.lg, alignItems: 'center'},
        clearButton: {marginTop: theme.spacing.xs},
      }),
    [chevronForward, listCard, row, theme],
  );

  useEffect(() => {
    if (!visible || loadingInitial) {
      return;
    }

    const cacheIds = getAdminNotificationListCacheEvents().map((event) => event.id);
    markAdminNotificationsRead(cacheIds);
    markAllRead();
  }, [displayItems.length, loadingInitial, markAllRead, visible]);

  const handleClearSharedLog = useCallback(() => {
    if (!canClearSharedLog || clearing) {
      return;
    }

    Alert.alert(t('adminNotificationsClearAll'), t('adminNotificationsClearAllConfirm'), [
      {text: t('cancel'), style: 'cancel'},
      {
        text: t('adminNotificationsClearAll'),
        style: 'destructive',
        onPress: () => {
          setClearing(true);
          void clearSharedNotificationEvents()
            .then(() => {
              stopAdminNotificationsNewerListener();
              clearAdminNotificationListCache();
              useAdminNotificationStore.getState().replaceAllNotifications([]);
              resetLocalLog();
            })
            .catch(() => {
              Alert.alert(t('error'), t('adminNotificationsClearFailed'));
            })
            .finally(() => {
              setClearing(false);
            });
        },
      },
    ]);
  }, [canClearSharedLog, clearing, resetLocalLog, t]);

  const handleNotificationPress = useCallback(
    (item: AdminNotificationRecord) => {
      markRead(item.id);
      useAdminNotificationsUiStore.getState().markNavigationFromSheet();
      InteractionManager.runAfterInteractions(() => {
        const navigated = navigateFromAdminNotification(item);
        if (!navigated) {
          useAdminNotificationsUiStore.getState().cancelNotificationReturn();
          return;
        }

        if (isStandaloneOrderAdminNotificationKind(item.kind)) {
          return;
        }

        InteractionManager.runAfterInteractions(() => {
          captureAdminNotificationDestinationRoute();
        });
      });
    },
    [markRead],
  );

  const renderItem = useCallback(
    ({item}: {item: AdminNotificationRecord}) => {
      const presentation = getAdminNotificationPresentation(item.kind, theme);
      const displayTimestamp = item.eventAt ?? item.receivedAt;

      return (
        <Pressable
          style={({pressed}) => [
            styles.card,
            !item.read ? styles.cardUnread : null,
            {
              opacity: pressed ? 0.92 : 1,
              borderColor: !item.read ? `${presentation.accentColor}55` : theme.colors.cardBorder,
            },
          ]}
          onPress={() => handleNotificationPress(item)}
        >
          <View style={[styles.accentBar, {backgroundColor: presentation.accentColor}]} />

          <View style={styles.cardInner}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrap, {backgroundColor: presentation.accentBackground}]}>
                <MaterialCommunityIcons
                  name={presentation.icon}
                  size={16}
                  color={presentation.accentColor}
                />
              </View>
              <Text
                style={[styles.category, inlineTextStyle, {color: presentation.accentColor}]}
                numberOfLines={1}
              >
                {t(presentation.categoryKey)}
              </Text>
              <Text style={[styles.headerTime, inlineTextStyle]}>
                {formatAdminNotificationTimestamp(displayTimestamp, t)}
              </Text>
            </View>

            <Text style={[styles.title, textStyle, {color: theme.typography.primary}]} numberOfLines={2}>
              {item.title}
            </Text>

            {item.body.trim() || resolveAdminNotificationActorName(item) ? (
              <AdminNotificationBodyText item={item} style={styles.body} numberOfLines={6} />
            ) : null}

            <View style={styles.footerRow}>
              <Text style={[styles.footerHint, inlineTextStyle]}>{t('adminNotificationsOpenHint')}</Text>
              <MaterialCommunityIcons
                name={chevronForward}
                size={16}
                color={theme.typography.muted}
              />
            </View>
          </View>
        </Pressable>
      );
    },
    [chevronForward, handleNotificationPress, inlineTextStyle, styles, t, textStyle, theme],
  );

  const renderSeparator = useCallback(() => <View style={styles.itemSeparator} />, [styles.itemSeparator]);

  return (
    <BottomSheet
      visible={visible}
      title={t('adminNotificationsTitle')}
      onClose={onClose}
      bodyScrollable={false}
      showsScrollIndicator
      sheetStyle={{height: '75%', maxHeight: '75%'}}
    >
      <View style={[styles.sheetBody, styles.sheetBodyFlex]}>
        <Text style={[styles.toolbarHint, textStyle]}>{t('adminNotificationsHint')}</Text>

        {loadingInitial && displayItems.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : displayItems.length === 0 ? (
          <EmptyState icon="bell-off-outline" message={t('adminNotificationsEmpty')} />
        ) : (
          <FlatList
            data={displayItems}
            style={styles.list}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={renderSeparator}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
            onEndReached={() => {
              if (hasMore && !loadingMore && displayItems.length > 0) {
                void loadMore();
              }
            }}
            onEndReachedThreshold={0.4}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={7}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={theme.colors.primary} size="small" />
                </View>
              ) : hasMore ? (
                <Pressable
                  style={styles.loadMoreButton}
                  onPress={() => {
                    void loadMore();
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.loadMoreText, textStyle, {color: theme.colors.primary}]}>
                    {t('adminNotificationsLoadMore')}
                  </Text>
                </Pressable>
              ) : null
            }
          />
        )}

        {canClearSharedLog && displayItems.length > 0 ? (
          <AppButton
            label={t('adminNotificationsClearAll')}
            variant="outline"
            onPress={handleClearSharedLog}
            loading={clearing}
            style={styles.clearButton}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
};

export default AdminNotificationsSheet;
