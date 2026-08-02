import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import AppInput from '@app/components/common/AppInput';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {sanitizeCustomerPhoneInput, sanitizeSingleCustomerPhoneInput} from '@app/utils/customerPhone';
import OrderFulfillmentTypePicker from '@app/components/pricing/OrderFulfillmentTypePicker';
import type {OrderFulfillmentType} from '@app/types/orderFulfillmentType';

interface Props {
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  fulfillmentType?: OrderFulfillmentType | null;
  onFulfillmentTypeChange?: (value: OrderFulfillmentType) => void;
  showFulfillmentType?: boolean;
  fulfillmentTypeError?: string;
  customerNameError?: string;
  customerPhoneError?: string;
  customerPhone2Error?: string;
  customerLocationError?: string;
  customerPhone: string;
  onCustomerPhoneChange: (value: string) => void;
  customerPhone2?: string;
  onCustomerPhone2Change?: (value: string) => void;
  showSecondPhone?: boolean;
  customerLocation: string;
  onCustomerLocationChange: (value: string) => void;
  customerNotes: string;
  onCustomerNotesChange: (value: string) => void;
  customerPhotosLink?: string;
  onCustomerPhotosLinkChange?: (value: string) => void;
  showPhotosLink?: boolean;
  collectedAmount: number;
  onCollectedAmountChange: (value: number) => void;
  fullPrice: number;
  onFullPriceChange: (value: number) => void;
  fullPriceLocked?: boolean;
  remainingLabel: string;
  pieceCount?: number;
  onPieceCountChange?: (value: number) => void;
  showPieceCount?: boolean;
  sectionTitle?: string;
}

const MirrorOrderCustomerFields: React.FC<Props> = ({
  customerName,
  onCustomerNameChange,
  fulfillmentType = null,
  onFulfillmentTypeChange,
  showFulfillmentType = false,
  fulfillmentTypeError,
  customerNameError,
  customerPhoneError,
  customerPhone2Error,
  customerLocationError,
  customerPhone,
  onCustomerPhoneChange,
  customerPhone2 = '',
  onCustomerPhone2Change,
  showSecondPhone = false,
  customerLocation,
  onCustomerLocationChange,
  customerNotes,
  onCustomerNotesChange,
  customerPhotosLink = '',
  onCustomerPhotosLinkChange,
  showPhotosLink = true,
  collectedAmount,
  onCollectedAmountChange,
  fullPrice,
  onFullPriceChange,
  fullPriceLocked = false,
  remainingLabel,
  pieceCount = 0,
  onPieceCountChange,
  showPieceCount = false,
  sectionTitle,
}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, row, layoutStyle} = useDirection();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {gap: 2},
        sectionTitle: {
          fontSize: theme.typographyScale.size.xs,
          fontWeight: '700',
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          opacity: 0.7,
          marginBottom: theme.spacing.xs,
        },
        fields: {gap: 2},
        fieldGap: {marginBottom: 0},
        fieldRow: {
          flexDirection: row,
          alignItems: 'flex-start',
          gap: theme.spacing.xs,
        },
        fieldColWide: {flex: 1.4, minWidth: 0},
        fieldCol: {flex: 1, minWidth: 0},
        fieldColNarrow: {flex: 0.85, minWidth: 0},
        inputDense: {minHeight: 34, paddingVertical: 6},
      }),
    [row, theme],
  );

  return (
    <View style={styles.section}>
      {sectionTitle ? (
        <Text style={[styles.sectionTitle, textStyle, {color: theme.typography.secondary}]}>
          {sectionTitle}
        </Text>
      ) : null}

      <View style={styles.fields}>
        {showFulfillmentType && onFulfillmentTypeChange ? (
          <OrderFulfillmentTypePicker
            value={fulfillmentType}
            onChange={onFulfillmentTypeChange}
            error={fulfillmentTypeError}
          />
        ) : null}

        <AppInput
          compact
          containerStyle={styles.fieldGap}
          fieldKey="customerName"
          label={t('customerName')}
          value={customerName}
          onChangeText={onCustomerNameChange}
          placeholder={t('mirrorCartCustomerNamePlaceholder')}
          error={customerNameError}
          style={styles.inputDense}
        />

        <View style={[styles.fieldRow, layoutStyle]}>
          <View style={showPieceCount ? styles.fieldColWide : styles.fieldCol}>
            <AppInput
              compact
              containerStyle={styles.fieldGap}
              fieldKey="customerPhone"
              label={t('mirrorCartCustomerPhone')}
              value={customerPhone}
              onChangeText={(value) => onCustomerPhoneChange(sanitizeCustomerPhoneInput(value))}
              placeholder={t('mirrorCartCustomerPhonePlaceholder')}
              keyboardType="phone-pad"
              forceLtr
              textContentType="telephoneNumber"
              autoCapitalize="none"
              autoCorrect={false}
              error={customerPhoneError}
              style={styles.inputDense}
            />
          </View>
          {showPieceCount && onPieceCountChange ? (
            <View style={styles.fieldColNarrow}>
              <AppInput
                compact
                containerStyle={styles.fieldGap}
                fieldKey="pieceCount"
                label={t('customerPieceCount')}
                numeric
                preserveZero
                value={pieceCount}
                onNumberChange={(value) => onPieceCountChange(Math.max(0, Math.round(value)))}
                keyboardType="number-pad"
                placeholder="0"
                style={styles.inputDense}
              />
            </View>
          ) : null}
        </View>

        {showSecondPhone && onCustomerPhone2Change ? (
          <AppInput
            compact
            containerStyle={styles.fieldGap}
            fieldKey="customerPhone2"
            label={t('mirrorCartCustomerPhone2')}
            value={customerPhone2}
            onChangeText={(value) => onCustomerPhone2Change(sanitizeSingleCustomerPhoneInput(value))}
            placeholder={t('mirrorCartCustomerPhone2Placeholder')}
            keyboardType="phone-pad"
            forceLtr
            textContentType="telephoneNumber"
            autoCapitalize="none"
            autoCorrect={false}
            error={customerPhone2Error}
            style={styles.inputDense}
          />
        ) : null}

        <AppInput
          compact
          containerStyle={styles.fieldGap}
          fieldKey="customerLocation"
          label={t('mirrorCartLocation')}
          value={customerLocation}
          onChangeText={onCustomerLocationChange}
          placeholder={t('mirrorCartLocationPlaceholder')}
          error={customerLocationError}
          style={styles.inputDense}
        />

        <AppInput
          compact
          containerStyle={styles.fieldGap}
          fieldKey="customerNotes"
          label={t('mirrorCartCustomerNotes')}
          value={customerNotes}
          onChangeText={onCustomerNotesChange}
          placeholder={t('mirrorCartCustomerNotesPlaceholder')}
          multiline
          autoGrow
        />

        {showPhotosLink ? (
          <AppInput
            compact
            containerStyle={styles.fieldGap}
            fieldKey="customerPhotosLink"
            label={t('mirrorCartCustomerPhotosLink')}
            value={customerPhotosLink}
            onChangeText={onCustomerPhotosLinkChange ?? (() => undefined)}
            placeholder={t('mirrorCartCustomerPhotosLinkPlaceholder')}
            keyboardType="url"
            autoCapitalize="none"
            style={styles.inputDense}
          />
        ) : null}

        <View style={[styles.fieldRow, layoutStyle]}>
          <View style={styles.fieldCol}>
            <AppInput
              compact
              containerStyle={styles.fieldGap}
              fieldKey="orderTotal"
              label={t('mirrorCartFullPrice')}
              numeric
              preserveZero
              value={fullPrice}
              onNumberChange={onFullPriceChange}
              keyboardType="numeric"
              placeholder="0"
              editable={!fullPriceLocked}
              style={styles.inputDense}
            />
          </View>
          <View style={styles.fieldCol}>
            <AppInput
              compact
              containerStyle={styles.fieldGap}
              fieldKey="collectedAmount"
              label={t('mirrorCartCollectedAmount')}
              numeric
              preserveZero
              value={collectedAmount}
              onNumberChange={onCollectedAmountChange}
              keyboardType="numeric"
              placeholder="0"
              style={styles.inputDense}
            />
          </View>
          <View style={styles.fieldCol}>
            <AppInput
              compact
              containerStyle={styles.fieldGap}
              label={t('mirrorCartRemainingAmount')}
              value={remainingLabel}
              editable={false}
              style={styles.inputDense}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

export default MirrorOrderCustomerFields;
