import React, {useMemo, useState, type ComponentProps} from 'react';

import {Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import {MaterialCommunityIcons} from '@expo/vector-icons';

import {useTranslation} from 'react-i18next';

import AppButton from '@app/components/common/AppButton';

import EmptyState from '@app/components/common/EmptyState';

import ListLoadingState from '@app/components/common/ListLoadingState';

import {useDirection} from '@app/hooks/useDirection';

import {useTheme} from '@app/context/ThemeContext';

import type {AppUser, AttendanceRecord} from '@app/types/models';

import dayjs from 'dayjs';

import {

  buildAttendanceDays,

  computeAttendanceStats,

  dayHasAttendanceActivity,

  dayIsAbsent,

  dayIsManageable,

  expandAttendanceDaysForPeriod,

  formatAttendanceDuration,

  getNextAttendanceAction,

  getTodayAttendanceStatus,

  hasOpenAttendanceToday,

  type AttendanceDaySummary,

} from '@app/utils/attendanceReport';

import LiveAttendanceDurationText from '@app/components/attendance/LiveAttendanceDurationText';

import {filterRecordsForCurrentPeriod, filterStaleResetRecords, resolveResetPeriodAnchor} from '@app/utils/attendanceSchedule';

import {searchAttendanceRecords} from '@app/utils/attendanceSearch';

import {getAttendanceWorkplace} from '@app/utils/attendanceWorkplace';

import {formatDate, formatTime} from '@app/utils/format';

import {getListCardStyle} from '@shared/theme/themeHelpers';



interface Props {

  records: AttendanceRecord[];

  periodStartIso?: string | null;

  resetAnchorUser?: Pick<AppUser, 'createdAt' | 'attendanceResetScheduleUpdatedAt'> | null;

  loading?: boolean;

  searchQuery?: string;

  onSearchChange?: (value: string) => void;

  showActions?: boolean;

  onAction?: (type: 'check_in' | 'check_out') => void;

  actionLoading?: boolean;

  requireLocationCheck?: boolean;

  requireGpsLinked?: boolean;

  canManageRecords?: boolean;

  onPressDay?: (day: AttendanceDaySummary) => void;

}



type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];



interface StatMetricProps {

  icon: IconName;

  iconColor: string;

  iconBackground: string;

  label: string;

  value: string;

}



const StatMetric: React.FC<StatMetricProps> = ({icon, iconColor, iconBackground, label, value}) => {

  const {theme} = useTheme();

  const {textStyle, centeredTextStyle} = useDirection();



  return (

    <View style={statStyles.metric}>

      <View style={[statStyles.iconWrap, {backgroundColor: iconBackground}]}>

        <MaterialCommunityIcons name={icon} size={16} color={iconColor} />

      </View>

      <Text

        style={[statStyles.label, textStyle, centeredTextStyle, {color: theme.typography.secondary}]}

        numberOfLines={2}

      >

        {label}

      </Text>

      <Text style={[statStyles.value, textStyle, centeredTextStyle, {color: theme.typography.primary}]}>

        {value}

      </Text>

    </View>

  );

};



const statStyles = StyleSheet.create({

  metric: {flex: 1, alignItems: 'center', paddingVertical: 8},

  iconWrap: {

    width: 30,

    height: 30,

    borderRadius: 15,

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 4,

  },

  label: {

    fontSize: 11,

    fontWeight: '600',

    marginBottom: 2,

    textAlign: 'center',

  },

  value: {

    fontSize: 14,

    fontWeight: '800',

    textAlign: 'center',

  },

});



const AttendanceReportPanel: React.FC<Props> = ({

  records,

  periodStartIso = null,

  resetAnchorUser = null,

  loading = false,

  searchQuery = '',

  onSearchChange,

  showActions = false,

  onAction,

  actionLoading = false,

  requireLocationCheck = false,

  requireGpsLinked = false,

  canManageRecords = false,

  onPressDay,

}) => {

  const {t} = useTranslation();

  const {theme} = useTheme();

  const {textStyle, inlineTextStyle, centeredTextStyle, ltrTextStyle, appFont, row, textAlign, writingDirection, layoutStyle} =

    useDirection();

  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const todayKey = useMemo(() => dayjs().format('YYYY-MM-DD'), []);

  const isLiveTodayOpen = hasOpenAttendanceToday(records);



  const displayRecords = useMemo(() => {

    const anchor = resolveResetPeriodAnchor(resetAnchorUser, records);

    return filterStaleResetRecords(records, anchor);

  }, [records, resetAnchorUser]);



  const periodRecords = useMemo(

    () => filterRecordsForCurrentPeriod(displayRecords, periodStartIso),

    [displayRecords, periodStartIso],

  );



  const allDays = useMemo(

    () => buildAttendanceDays(displayRecords, dayjs(), {includeLiveDuration: false}),

    [displayRecords],

  );

  const statsDays = useMemo(

    () => buildAttendanceDays(periodRecords, dayjs(), {includeLiveDuration: false}),

    [periodRecords],

  );

  const stats = useMemo(() => computeAttendanceStats(statsDays), [statsDays]);

  const filteredRecords = useMemo(

    () => searchAttendanceRecords(displayRecords, searchQuery),

    [displayRecords, searchQuery],

  );

  const periodDays = useMemo(

    () => expandAttendanceDaysForPeriod(allDays, periodStartIso, dayjs()),

    [allDays, periodStartIso],

  );



  const days = useMemo(() => {

    if (!searchQuery.trim()) {

      return periodDays;

    }



    const visibleIds = new Set(filteredRecords.map((record) => record.id));

    const query = searchQuery.trim().toLowerCase();



    return periodDays

      .map((day) => ({

        ...day,

        records: day.records.filter((record) => visibleIds.has(record.id)),

      }))

      .filter((day) => {

        if (day.records.length > 0) {

          return true;

        }



        const dateLabel = formatDate(`${day.dateKey}T12:00:00`).toLowerCase();

        return dateLabel.includes(query) || day.dateKey.includes(query);

      });

  }, [filteredRecords, periodDays, searchQuery]);

  const nextAction = useMemo(() => getNextAttendanceAction(records), [records]);

  const todayStatus = useMemo(() => getTodayAttendanceStatus(records, t), [records, t]);

  const hasSearchQuery = searchQuery.trim().length > 0;

  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);



  const toggleDay = (dateKey: string) => {

    setExpandedDayKey((current) => (current === dateKey ? null : dateKey));

  };



  const styles = useMemo(

    () =>

      StyleSheet.create({

        statusCard: {

          padding: theme.spacing.md,

          marginBottom: theme.spacing.sm,

          alignItems: 'center',

        },

        statusIconWrap: {

          width: 36,

          height: 36,

          borderRadius: 18,

          alignItems: 'center',

          justifyContent: 'center',

          backgroundColor: theme.colors.surfaceSecondary,

          marginBottom: theme.spacing.xs,

        },

        statusLabel: {

          fontSize: theme.typographyScale.size.xs,

          marginBottom: 2,

        },

        statusValue: {

          fontSize: theme.typographyScale.size.sm,

          fontWeight: '700',

          marginBottom: theme.spacing.sm,

        },

        actionBtn: {width: '100%'},

        locationHint: {

          marginTop: theme.spacing.sm,

          fontSize: theme.typographyScale.size.xs,

          lineHeight: 18,

          textAlign: 'center',

        },

        statsCard: {

          overflow: 'hidden',

          marginBottom: theme.spacing.sm,

        },

        statsRow: {flexDirection: row, alignItems: 'stretch'},

        statsDivider: {

          width: 1,

          backgroundColor: theme.colors.divider,

          marginVertical: theme.spacing.sm,

        },

        statsPeriodHint: {

          fontSize: theme.typographyScale.size.xs,

          textAlign: 'center',

          paddingHorizontal: theme.spacing.md,

          paddingBottom: theme.spacing.sm,

        },

        sectionTitle: {

          fontSize: theme.typographyScale.size.sm,

          fontWeight: '600',

          marginBottom: theme.spacing.xs,

        },

        searchWrap: {

          flexDirection: row,

          alignItems: 'center',

          marginBottom: theme.spacing.sm,

          paddingHorizontal: theme.spacing.md,

          gap: theme.spacing.sm,

          borderWidth: 1,

          borderColor: theme.colors.inputBorder,

          backgroundColor: theme.colors.inputBackground,

          borderRadius: theme.components.input.radius,

          minHeight: 40,

        },

        searchInput: {

          flex: 1,

          fontSize: theme.typographyScale.size.xs,

          paddingVertical: Platform.OS === 'android' ? 6 : 8,

          ...(Platform.OS === 'android' ? {includeFontPadding: false} : null),

        },

        dayCard: {

          marginBottom: theme.spacing.sm,

          overflow: 'hidden',

        },

        dayRow: {

          flexDirection: row,

          alignItems: 'center',

          paddingHorizontal: theme.spacing.md,

          paddingVertical: theme.spacing.sm,

          gap: theme.spacing.sm,

          minHeight: 56,

        },

        dayRowIconWrap: {

          width: 36,

          height: 36,

          borderRadius: 18,

          alignItems: 'center',

          justifyContent: 'center',

          backgroundColor: theme.colors.surfaceSecondary,

          flexShrink: 0,

        },

        dayRowBody: {

          flex: 1,

          minWidth: 0,

          gap: 2,

        },

        dayTitle: {

          fontSize: theme.typographyScale.size.sm,

          fontWeight: '700',

        },

        dayRowMeta: {

          fontSize: theme.typographyScale.size.xs,

          lineHeight: 16,

        },

        dayStatusPill: {

          flexShrink: 0,

          borderRadius: theme.radius.sm,

          paddingHorizontal: 8,

          paddingVertical: 4,

          maxWidth: 110,

        },

        dayStatusText: {

          fontSize: theme.typographyScale.size.xs,

          fontWeight: '700',

          textAlign: 'center',

        },

        dayDetails: {

          borderTopWidth: StyleSheet.hairlineWidth,

          borderTopColor: theme.colors.divider,

          paddingHorizontal: theme.spacing.md,

          paddingBottom: theme.spacing.md,

          paddingTop: theme.spacing.sm,

          gap: theme.spacing.xs,

        },

        eventRow: {

          flexDirection: row,

          alignItems: 'center',

          paddingVertical: 4,

          gap: theme.spacing.sm,

        },

        eventLabel: {flex: 1, minWidth: 0, fontSize: theme.typographyScale.size.xs, fontWeight: '600'},

        eventTime: {flexShrink: 0, fontSize: theme.typographyScale.size.xs},

        sessionDivider: {

          borderTopWidth: StyleSheet.hairlineWidth,

          borderTopColor: theme.colors.divider,

          marginVertical: theme.spacing.xs,

        },

        incomplete: {

          marginTop: theme.spacing.xs,

          fontSize: theme.typographyScale.size.xs,

        },

        manageHint: {

          fontSize: theme.typographyScale.size.xs,

          marginBottom: theme.spacing.sm,

          lineHeight: 18,

        },

        editDayButton: {

          flexDirection: row,

          alignItems: 'center',

          justifyContent: 'center',

          gap: 6,

          marginTop: theme.spacing.sm,

          paddingVertical: theme.spacing.sm,

          borderRadius: theme.components.input.radius,

          borderWidth: 1,

          borderColor: theme.colors.primary,

        },

        editDayText: {

          fontSize: theme.typographyScale.size.xs,

          fontWeight: '700',

        },

      }),

    [row, theme],

  );



  if (loading) {

    return <ListLoadingState />;

  }



  return (

    <View>

      {showActions ? (

        <View style={[styles.statusCard, listCard]}>

          <View style={styles.statusIconWrap}>

            <MaterialCommunityIcons name="calendar-clock" size={20} color={theme.colors.primary} />

          </View>

          <Text style={[styles.statusLabel, textStyle, {color: theme.typography.secondary}]}>

            {t('attendanceTodayStatus')}

          </Text>

          <Text style={[styles.statusValue, textStyle, {color: theme.typography.primary}]}>{todayStatus}</Text>

          <AppButton

            label={nextAction === 'check_in' ? t('checkIn') : t('checkOut')}

            variant={nextAction === 'check_in' ? 'success' : 'danger'}

            onPress={() => onAction?.(nextAction)}

            loading={actionLoading}

            style={styles.actionBtn}

          />

          {requireLocationCheck ? (
            <Text style={[styles.locationHint, centeredTextStyle, textStyle, {color: theme.typography.secondary}]}>
              {nextAction === 'check_in'
                ? t('attendanceLocationCheckInHint', {name: getAttendanceWorkplace().name})
                : t('attendanceLocationCheckOutHint', {name: getAttendanceWorkplace().name})}
            </Text>
          ) : null}

          {requireGpsLinked ? (

            <Text style={[styles.locationHint, centeredTextStyle, textStyle, {color: theme.colors.primary}]}>

              {t('attendanceGpsLinkedActiveHint')}

            </Text>

          ) : null}

        </View>

      ) : null}



      <View style={[styles.statsCard, listCard]}>

        <View style={styles.statsRow}>

          <StatMetric

            icon="calendar-check"

            iconColor={theme.colors.success}

            iconBackground={theme.colors.successLight}

            label={t('attendanceDays')}

            value={String(stats.daysWithCheckIn)}

          />

          <View style={styles.statsDivider} />

          <StatMetric

            icon="calendar-sync"

            iconColor={theme.colors.primary}

            iconBackground={theme.colors.surfaceSecondary}

            label={t('attendanceCompletedDays')}

            value={String(stats.completedSessions)}

          />

          <View style={styles.statsDivider} />

          <View style={statStyles.metric}>

            <View style={[statStyles.iconWrap, {backgroundColor: theme.colors.surfaceSecondary}]}>

              <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.warning} />

            </View>

            <Text

              style={[statStyles.label, textStyle, centeredTextStyle, {color: theme.typography.secondary}]}

              numberOfLines={2}

            >

              {t('attendanceTotalHours')}

            </Text>

            {isLiveTodayOpen ? (

              <LiveAttendanceDurationText

                baseSeconds={stats.totalSeconds}

                records={periodRecords}

                style={[statStyles.value, textStyle, centeredTextStyle, {color: theme.typography.primary}]}

              />

            ) : (

              <Text style={[statStyles.value, textStyle, centeredTextStyle, {color: theme.typography.primary}]}>

                {formatAttendanceDuration(stats.totalSeconds)}

              </Text>

            )}

          </View>

        </View>

        {periodStartIso ? (

          <Text style={[styles.statsPeriodHint, textStyle, {color: theme.typography.secondary}]}>

            {t('attendanceStatsCurrentPeriod')}

          </Text>

        ) : null}

      </View>



      <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>

        {t('attendanceReport')}

      </Text>



      {canManageRecords ? (

        <Text style={[styles.manageHint, textStyle, {color: theme.typography.secondary}]}>

          {t('attendanceManageHint')}

        </Text>

      ) : null}



      {onSearchChange ? (

        <View style={[styles.searchWrap, layoutStyle]}>

          <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.icon} />

          <TextInput

            value={searchQuery}

            onChangeText={onSearchChange}

            placeholder={t('searchAttendance')}

            placeholderTextColor={theme.colors.placeholder}

            style={[styles.searchInput, {color: theme.typography.primary, textAlign, writingDirection}]}

            returnKeyType="search"

            clearButtonMode="while-editing"

          />

        </View>

      ) : null}



      {days.length === 0 ? (

        <EmptyState

          icon="calendar-clock"

          message={hasSearchQuery ? t('noAttendanceMatch') : t('employeeAttendanceEmpty')}

        />

      ) : (

        days.map((day) => {

          const isExpanded = expandedDayKey === day.dateKey;

          const canEditDay = canManageRecords && onPressDay && dayIsManageable(day);

          const isAbsentDay = dayIsAbsent(day);

          const hasActivity = dayHasAttendanceActivity(day);

          const isTodayWithoutActivity = day.dateKey === todayKey && !hasActivity;

          const checkInRecord = day.records.find((record) => record.type === 'check_in');

          const checkOutRecord = [...day.records].reverse().find((record) => record.type === 'check_out');

          const timeRangeLabel =

            checkInRecord && checkOutRecord

              ? `${formatTime(checkInRecord.createdAt)} - ${formatTime(checkOutRecord.createdAt)}`

              : checkInRecord

                ? `${formatTime(checkInRecord.createdAt)} - ${t('attendanceMissingCheckOut')}`

                : null;



          let statusLabel = t('attendanceNotCheckedInToday');

          let statusColor = theme.typography.secondary;

          let statusBackground = theme.colors.surfaceSecondary;



          if (isAbsentDay) {

            statusLabel = t('attendanceAbsent');

            statusColor = theme.colors.danger;

            statusBackground = theme.colors.dangerLight;

          } else if (day.isOpen && day.dateKey === todayKey) {

            statusLabel = formatAttendanceDuration(day.totalDurationSeconds);

            statusColor = theme.colors.primary;

            statusBackground = `${theme.colors.primary}18`;

          } else if (day.totalDurationSeconds > 0) {

            statusLabel = formatAttendanceDuration(day.totalDurationSeconds);

            statusColor = theme.colors.primary;

            statusBackground = `${theme.colors.primary}18`;

          } else if (!isTodayWithoutActivity) {

            statusLabel = t('attendanceNoActivityShort');

            statusColor = theme.typography.muted;

            statusBackground = theme.colors.surfaceSecondary;

          }



          const dayIconColor = isAbsentDay

            ? theme.colors.danger

            : hasActivity

              ? theme.colors.success

              : theme.colors.icon;



          return (

            <View key={day.dateKey} style={[styles.dayCard, listCard]}>

              <Pressable

                onPress={() => toggleDay(day.dateKey)}

                style={({pressed}) => [

                  styles.dayRow,

                  layoutStyle,

                  pressed ? {backgroundColor: theme.colors.surfaceSecondary} : null,

                ]}

                accessibilityRole="button"

                accessibilityState={{expanded: isExpanded}}

              >

                <View style={styles.dayRowIconWrap}>

                  <MaterialCommunityIcons name="calendar-outline" size={18} color={dayIconColor} />

                </View>



                <View style={styles.dayRowBody}>

                  <Text style={[styles.dayTitle, inlineTextStyle, {color: theme.typography.primary}]} numberOfLines={1}>

                    {formatDate(`${day.dateKey}T12:00:00`)}

                  </Text>

                  {timeRangeLabel && !isAbsentDay ? (

                    <Text

                      style={[styles.dayRowMeta, ltrTextStyle, appFont('medium'), {color: theme.typography.secondary}]}

                      numberOfLines={1}

                    >

                      {timeRangeLabel}

                    </Text>

                  ) : isTodayWithoutActivity ? (

                    <Text style={[styles.dayRowMeta, inlineTextStyle, {color: theme.typography.muted}]} numberOfLines={1}>

                      {t('attendanceNotCheckedInToday')}

                    </Text>

                  ) : isAbsentDay && day.records[0]?.note ? (

                    <Text style={[styles.dayRowMeta, inlineTextStyle, {color: theme.typography.secondary}]} numberOfLines={1}>

                      {day.records[0].note}

                    </Text>

                  ) : null}

                </View>



                <View style={[styles.dayStatusPill, {backgroundColor: statusBackground}]}>

                  {day.isOpen && day.dateKey === todayKey ? (

                    <LiveAttendanceDurationText

                      baseSeconds={day.totalDurationSeconds}

                      records={day.records}

                      style={[styles.dayStatusText, inlineTextStyle, {color: statusColor}]}

                    />

                  ) : (

                    <Text style={[styles.dayStatusText, inlineTextStyle, {color: statusColor}]} numberOfLines={1}>

                      {statusLabel}

                    </Text>

                  )}

                </View>



                <MaterialCommunityIcons

                  name={isExpanded ? 'chevron-up' : 'chevron-down'}

                  size={20}

                  color={theme.colors.icon}

                />

              </Pressable>



              {isExpanded ? (

                <View style={styles.dayDetails}>

                  {day.records.map((record, index) => (

                    <View key={record.id}>

                      {index > 0 ? <View style={styles.sessionDivider} /> : null}

                      {record.type === 'absent' ? (

                        <>

                          <View style={styles.eventRow}>

                            <Text

                              style={[

                                styles.eventLabel,

                                inlineTextStyle,

                                {color: theme.colors.danger, flex: 1},

                              ]}

                            >

                              {t('attendanceAbsent')}

                            </Text>

                          </View>

                          {record.note ? (

                            <Text

                              style={[

                                styles.incomplete,

                                inlineTextStyle,

                                {color: theme.typography.secondary, marginTop: 2},

                              ]}

                            >

                              {record.note}

                            </Text>

                          ) : null}

                        </>

                      ) : record.type === 'hours_reset' ? (

                        <>

                          <View style={styles.eventRow}>

                            <Text

                              style={[

                                styles.eventLabel,

                                inlineTextStyle,

                                {color: theme.colors.warning, flex: 1},

                              ]}

                            >

                              {t('attendanceHoursReset')}

                            </Text>

                            <Text

                              style={[

                                styles.eventTime,

                                ltrTextStyle,

                                appFont('medium'),

                                {color: theme.typography.secondary},

                              ]}

                            >

                              {formatTime(record.createdAt)}

                            </Text>

                          </View>

                          {record.note ? (

                            <Text

                              style={[

                                styles.incomplete,

                                inlineTextStyle,

                                {color: theme.typography.secondary, marginTop: 2},

                              ]}

                            >

                              {record.note}

                            </Text>

                          ) : null}

                        </>

                      ) : (

                        <View style={styles.eventRow}>

                          <Text

                            style={[

                              styles.eventLabel,

                              inlineTextStyle,

                              {color: record.type === 'check_in' ? theme.colors.success : theme.colors.danger},

                            ]}

                          >

                            {record.type === 'check_in' ? t('checkIn') : t('checkOut')}

                          </Text>

                          <Text

                            style={[

                              styles.eventTime,

                              ltrTextStyle,

                              appFont('medium'),

                              {color: theme.typography.secondary},

                            ]}

                          >

                            {formatTime(record.createdAt)}

                          </Text>

                        </View>

                      )}

                    </View>

                  ))}



                  {day.isOpen ? (

                    <Text style={[styles.incomplete, inlineTextStyle, {color: theme.colors.warning}]}>

                      {t('attendanceMissingCheckOut')}

                    </Text>

                  ) : null}



                  {isTodayWithoutActivity ? (

                    <Text style={[styles.incomplete, inlineTextStyle, {color: theme.typography.secondary}]}>

                      {t('attendanceNotCheckedInToday')}

                    </Text>

                  ) : null}



                  {canEditDay ? (

                    <Pressable

                      onPress={() => onPressDay(day)}

                      style={({pressed}) => [

                        styles.editDayButton,

                        {opacity: pressed ? 0.75 : 1},

                      ]}

                      accessibilityRole="button"

                    >

                      <MaterialCommunityIcons name="pencil-outline" size={16} color={theme.colors.primary} />

                      <Text style={[styles.editDayText, inlineTextStyle, {color: theme.colors.primary}]}>

                        {t('editAttendanceDay')}

                      </Text>

                    </Pressable>

                  ) : null}

                </View>

              ) : null}

            </View>

          );

        })

      )}

    </View>

  );

};



export default AttendanceReportPanel;

