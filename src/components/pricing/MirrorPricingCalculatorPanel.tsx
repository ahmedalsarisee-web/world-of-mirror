import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppInput from '@app/components/common/AppInput';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {formatCurrency} from '@app/utils/format';
import {getListCardStyle} from '@shared/theme/themeHelpers';
import {computeMirrorPricing} from '@app/utils/mirrorPricing';

const MirrorPricingCalculatorPanel: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, ltrTextStyle, inlineTextStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const [lengthCm, setLengthCm] = useState(0);
  const [widthCm, setWidthCm] = useState(0);

  const showDetails = lengthCm > 0 && widthCm > 0;

  const pricing = useMemo(() => {
    if (!showDetails) {
      return null;
    }
    return computeMirrorPricing({lengthCm, widthCm});
  }, [lengthCm, showDetails, widthCm]);

  const pendingMessage = useMemo(() => {
    if (lengthCm <= 0) {
      return t('mirrorPricingEnterDimensions');
    }
    if (widthCm <= 0) {
      return t('mirrorPricingCompleteWidth');
    }
    return '';
  }, [lengthCm, t, widthCm]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {gap: theme.spacing.sm},
        card: {
          padding: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
        cardHeader: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '700',
        },
        inputsRow: {flexDirection: row, gap: theme.spacing.sm},
        inputHalf: {flex: 1},
        hint: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
          textAlign: 'center',
          paddingVertical: theme.spacing.xs,
        },
        metricsStrip: {
          flexDirection: row,
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.components.input.radius,
        },
        metricItem: {alignItems: 'center', minWidth: 72},
        metricLabel: {fontSize: 10, marginBottom: 2},
        metricValue: {fontSize: theme.typographyScale.size.sm, fontWeight: '700'},
        metricDot: {fontSize: theme.typographyScale.size.xs, opacity: 0.4},
        sectionTitle: {
          fontSize: theme.typographyScale.size.md,
          fontWeight: '700',
          marginBottom: theme.spacing.sm,
        },
        tableHeader: {
          flexDirection: row,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderBottomWidth: 1,
        },
        tableRow: {
          flexDirection: row,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          alignItems: 'center',
        },
        optionCol: {flex: 1.4, paddingEnd: theme.spacing.xs, minWidth: 0},
        priceCol: {flex: 1, alignItems: 'flex-end', flexShrink: 0},
        headerText: {fontSize: theme.typographyScale.size.xs, fontWeight: '700'},
        optionText: {fontSize: theme.typographyScale.size.xs, lineHeight: 18},
        priceText: {fontSize: theme.typographyScale.size.xs, fontWeight: '600'},
        priceHint: {marginTop: theme.spacing.sm, fontSize: theme.typographyScale.size.xs, lineHeight: 18},
        tableSection: {gap: theme.spacing.sm},
      }),
    [row, theme],
  );

  const renderPrice = (value?: number) => {
    if (value === undefined) {
      return '—';
    }
    return formatCurrency(value, t('currencyLabel'));
  };

  const renderPriceTable = (
    titleKey: string | null,
    options: Array<{id: string; labelKey: string; price4mm?: number; price6mm?: number}>,
  ) => (
    <View style={styles.tableSection}>
      {titleKey ? (
        <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary, marginBottom: 0}]}>
          {t(titleKey)}
        </Text>
      ) : null}
      <View style={[listCard, {overflow: 'hidden'}]}>
        <View
          style={[
            styles.tableHeader,
            {borderColor: theme.colors.divider, backgroundColor: theme.colors.surfaceSecondary},
          ]}
        >
          <View style={styles.optionCol}>
            <Text style={[styles.headerText, textStyle, {color: theme.typography.primary}]}>
              {t('mirrorPricingOption')}
            </Text>
          </View>
          <View style={styles.priceCol}>
            <Text style={[styles.headerText, ltrTextStyle, {color: theme.typography.primary}]}>
              {t('mirrorPrice4mm')}
            </Text>
          </View>
          <View style={styles.priceCol}>
            <Text style={[styles.headerText, ltrTextStyle, {color: theme.typography.primary}]}>
              {t('mirrorPrice6mm')}
            </Text>
          </View>
        </View>
        {options.map((option) => (
          <View key={option.id} style={[styles.tableRow, {borderColor: theme.colors.divider}]}>
            <View style={styles.optionCol}>
              <Text style={[styles.optionText, textStyle, {color: theme.typography.primary}]}>
                {t(option.labelKey)}
              </Text>
            </View>
            <View style={styles.priceCol}>
              <Text style={[styles.priceText, ltrTextStyle, {color: theme.typography.primary}]}>
                {renderPrice(option.price4mm)}
              </Text>
            </View>
            <View style={styles.priceCol}>
              <Text style={[styles.priceText, ltrTextStyle, {color: theme.typography.primary}]}>
                {renderPrice(option.price6mm)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.card, listCard]}>
        <Text style={[styles.cardHeader, textStyle, {color: theme.typography.primary}]}>
          {t('mirrorPricingDimensions')}
        </Text>
        <View style={[styles.inputsRow, layoutStyle]}>
          <View style={styles.inputHalf}>
            <AppInput
              label={t('mirrorLengthCm')}
              numeric
              value={lengthCm}
              onNumberChange={setLengthCm}
              selectTextOnFocus={false}
              keyboardType="numeric"
              returnKeyType="next"
              showSuccess={lengthCm > 0}
            />
          </View>
          <View style={styles.inputHalf}>
            <AppInput
              label={t('mirrorWidthCm')}
              numeric
              value={widthCm}
              onNumberChange={setWidthCm}
              selectTextOnFocus={false}
              keyboardType="numeric"
              returnKeyType="next"
              showSuccess={widthCm > 0}
            />
          </View>
        </View>

        {!showDetails || !pricing ? (
          pendingMessage ? (
            <Text style={[styles.hint, inlineTextStyle, {color: theme.typography.secondary}]}>
              {pendingMessage}
            </Text>
          ) : null
        ) : (
          <View style={[styles.metricsStrip, {backgroundColor: theme.colors.surfaceSecondary}]}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, textStyle, {color: theme.typography.secondary}]}>
                {t('mirrorArea')}
              </Text>
              <Text style={[styles.metricValue, ltrTextStyle, {color: theme.colors.primary}]}>
                {pricing.components.area.toFixed(2)} m²
              </Text>
            </View>
            <Text style={[styles.metricDot, ltrTextStyle, {color: theme.typography.secondary}]}>•</Text>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, textStyle, {color: theme.typography.secondary}]}>
                {t('mirrorPerimeter')}
              </Text>
              <Text style={[styles.metricValue, ltrTextStyle, {color: theme.colors.primary}]}>
                {pricing.components.perimeter.toFixed(2)} m
              </Text>
            </View>
          </View>
        )}
      </View>

      {showDetails && pricing ? (
        <>
          {renderPriceTable('mirrorPricingOrderOptions', pricing.orderOptions)}
          {pricing.extras.length > 0 ? renderPriceTable('mirrorPricingFrames', pricing.extras) : null}
          <Text style={[styles.priceHint, textStyle, {color: theme.typography.secondary}]}>
            {t('mirrorPricingHint')}
          </Text>
        </>
      ) : null}
    </View>
  );
};

export default MirrorPricingCalculatorPanel;
