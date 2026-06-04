import React, {useMemo, useState} from 'react';
import {Keyboard, StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppInput from '@app/components/common/AppInput';
import EmptyState from '@app/components/common/EmptyState';
import MirrorPricingAddToCartSection from '@app/components/pricing/MirrorPricingAddToCartSection';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {formatCurrency} from '@app/utils/format';
import {computeMirrorPricing} from '@app/utils/mirrorPricing';
import {getListCardStyle} from '@shared/theme/themeHelpers';

interface CommittedDimensions {
  lengthCm: number;
  widthCm: number;
}

interface Props {
  onAddedToCart?: () => void;
}

const MirrorPricingCalculatorPanel: React.FC<Props> = ({onAddedToCart}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle, ltrTextStyle} = useDirection();
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);

  const [lengthCm, setLengthCm] = useState(0);
  const [widthCm, setWidthCm] = useState(0);
  const [committedDimensions, setCommittedDimensions] = useState<CommittedDimensions | null>(null);

  const commitDimensions = () => {
    if (lengthCm > 0 && widthCm > 0) {
      setCommittedDimensions({lengthCm, widthCm});
      Keyboard.dismiss();
    }
  };

  const handleAddedToCart = () => {
    setLengthCm(0);
    setWidthCm(0);
    setCommittedDimensions(null);
    onAddedToCart?.();
  };

  const isDimensionsDirty =
    committedDimensions !== null &&
    (lengthCm !== committedDimensions.lengthCm || widthCm !== committedDimensions.widthCm);

  const showFullDetails =
    committedDimensions !== null &&
    !isDimensionsDirty &&
    committedDimensions.lengthCm > 0 &&
    committedDimensions.widthCm > 0;

  const pricing = useMemo(() => {
    if (!showFullDetails || !committedDimensions) {
      return null;
    }
    return computeMirrorPricing(committedDimensions);
  }, [committedDimensions, showFullDetails]);

  const showLengthCheck =
    lengthCm > 0 &&
    (committedDimensions === null ||
      (committedDimensions.lengthCm === lengthCm && !isDimensionsDirty));

  const showWidthCheck =
    widthCm > 0 &&
    (committedDimensions === null ||
      (committedDimensions.widthCm === widthCm && !isDimensionsDirty));

  const pendingMessage = useMemo(() => {
    if (lengthCm <= 0) {
      return t('mirrorPricingEnterDimensions');
    }
    if (widthCm <= 0) {
      return t('mirrorPricingCompleteWidth');
    }
    return t('mirrorPricingPressCheck');
  }, [lengthCm, t, widthCm]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {gap: theme.spacing.md},
        sectionTitle: {
          fontSize: theme.typographyScale.size.md,
          fontWeight: '700',
          marginBottom: theme.spacing.sm,
        },
        inputsRow: {flexDirection: row, gap: theme.spacing.sm},
        inputHalf: {flex: 1},
        metricsRow: {flexDirection: row, gap: theme.spacing.sm, marginTop: theme.spacing.md},
        metricCard: {flex: 1, padding: theme.spacing.md, alignItems: 'center'},
        metricLabel: {fontSize: theme.typographyScale.size.xs, marginBottom: 4},
        metricValue: {fontSize: theme.typographyScale.size.md, fontWeight: '700'},
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
        hint: {marginTop: theme.spacing.sm, fontSize: theme.typographyScale.size.xs, lineHeight: 18},
      }),
    [row, theme],
  );

  const renderPrice = (value?: number) => {
    if (value === undefined) {
      return '—';
    }
    return formatCurrency(value, t('currencyLabel'));
  };

  return (
    <View style={styles.root}>
      <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
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
            showSuccess={showLengthCheck}
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
            returnKeyType="done"
            blurOnSubmit
            submitBehavior="blurAndSubmit"
            onSubmitEditing={commitDimensions}
            showSuccess={showWidthCheck}
          />
        </View>
      </View>

      {!showFullDetails || !pricing || !committedDimensions ? (
        <EmptyState icon="check-circle-outline" message={pendingMessage} />
      ) : (
        <>
          <View style={[styles.metricsRow, layoutStyle]}>
            <View style={[styles.metricCard, listCard]}>
              <Text style={[styles.metricLabel, textStyle, {color: theme.typography.secondary}]}>
                {t('mirrorArea')}
              </Text>
              <Text style={[styles.metricValue, ltrTextStyle, {color: theme.colors.primary}]}>
                {pricing.components.area.toFixed(2)} m²
              </Text>
            </View>
            <View style={[styles.metricCard, listCard]}>
              <Text style={[styles.metricLabel, textStyle, {color: theme.typography.secondary}]}>
                {t('mirrorPerimeter')}
              </Text>
              <Text style={[styles.metricValue, ltrTextStyle, {color: theme.colors.primary}]}>
                {pricing.components.perimeter.toFixed(2)} m
              </Text>
            </View>
          </View>

          <MirrorPricingAddToCartSection
            lengthCm={committedDimensions.lengthCm}
            widthCm={committedDimensions.widthCm}
            onAdded={handleAddedToCart}
          />

          <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
            {t('mirrorPricingOrderOptions')}
          </Text>
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
            {pricing.orderOptions.map((option) => (
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

          <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.primary}]}>
            {t('mirrorPricingExtras')}
          </Text>
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
            {pricing.extras.map((extra) => (
              <View key={extra.id} style={[styles.tableRow, {borderColor: theme.colors.divider}]}>
                <View style={styles.optionCol}>
                  <Text style={[styles.optionText, textStyle, {color: theme.typography.primary}]}>
                    {t(extra.labelKey)}
                  </Text>
                </View>
                <View style={styles.priceCol}>
                  <Text style={[styles.priceText, ltrTextStyle, {color: theme.typography.primary}]}>
                    {renderPrice(extra.price4mm)}
                  </Text>
                </View>
                <View style={styles.priceCol}>
                  <Text style={[styles.priceText, ltrTextStyle, {color: theme.typography.primary}]}>
                    {renderPrice(extra.price6mm)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.hint, textStyle, {color: theme.typography.secondary}]}>
            {t('mirrorPricingHint')}
          </Text>
        </>
      )}
    </View>
  );
};

export default MirrorPricingCalculatorPanel;
