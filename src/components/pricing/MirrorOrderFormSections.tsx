import React, {useMemo} from 'react';

import {Pressable, StyleSheet, Text, View, type ReactNode} from 'react-native';

import {MaterialCommunityIcons} from '@expo/vector-icons';

import {useTranslation} from 'react-i18next';

import AppButton from '@app/components/common/AppButton';

import MirrorOrderCustomerFields from '@app/components/pricing/MirrorOrderCustomerFields';

import type {OrderFulfillmentType} from '@app/types/orderFulfillmentType';

import MirrorCatalogImagesEditor from '@app/components/pricing/MirrorCatalogImagesEditor';

import type {MirrorCatalogImageId} from '@app/data/mirrorCatalogImages';

import {useDirection} from '@app/hooks/useDirection';

import {useTheme} from '@app/context/ThemeContext';

import type {CatalogMirrorImageAnnotationData} from '@app/utils/catalogImageTextAnnotations';



interface Props {

  disabled?: boolean;

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

  pieceCount: number;

  onPieceCountChange: (value: number) => void;

  collectedAmount: number;

  onCollectedAmountChange: (value: number) => void;

  fullPrice: number;

  onFullPriceChange: (value: number) => void;

  fullPriceLocked?: boolean;

  remainingLabel: string;

  selectedCatalogImages: MirrorCatalogImageId[];

  onChangeSelectedCatalogImages: (ids: MirrorCatalogImageId[]) => void;

  catalogAnnotationData: CatalogMirrorImageAnnotationData;

  onChangeCatalogAnnotationData?: (data: CatalogMirrorImageAnnotationData) => void;

  studioOrderImages: string[];

  onChangeStudioUrls: (urls: string[]) => void;

  onAddStudioImages: () => void;

  onReplaceStudioImage: (imageUrl: string) => void;

  uploadingStudio?: boolean;

  destinationLabel?: string;

  onDestinationPress?: () => void;

  showDestination?: boolean;

  beforeCatalog?: ReactNode;

  afterInvoice?: ReactNode;

  primaryActionLabel: string;

  onPrimaryAction: () => void;

  primaryActionDisabled?: boolean;

  primaryActionLoading?: boolean;

}



const MirrorOrderFormSections: React.FC<Props> = ({

  disabled = false,

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

  pieceCount,

  onPieceCountChange,

  collectedAmount,

  onCollectedAmountChange,

  fullPrice,

  onFullPriceChange,

  fullPriceLocked = false,

  remainingLabel,

  selectedCatalogImages,

  onChangeSelectedCatalogImages,

  catalogAnnotationData,

  onChangeCatalogAnnotationData,

  studioOrderImages,

  onChangeStudioUrls,

  onAddStudioImages,

  onReplaceStudioImage,

  uploadingStudio = false,

  destinationLabel,

  onDestinationPress,

  showDestination = false,

  beforeCatalog,

  afterInvoice,

  primaryActionLabel,

  onPrimaryAction,

  primaryActionDisabled = false,

  primaryActionLoading = false,

}) => {

  const {t} = useTranslation();

  const {theme} = useTheme();

  const {textStyle, row, chevronForward} = useDirection();



  const styles = useMemo(

    () =>

      StyleSheet.create({

        root: {

          gap: theme.spacing.xs,

        },

        destinationBlock: {

          gap: theme.spacing.xs,

          marginTop: theme.spacing.xs,

        },

        destinationLabel: {

          fontSize: theme.typographyScale.size.xs,

          fontWeight: '700',

          letterSpacing: 0.3,

          textTransform: 'uppercase',

          opacity: 0.7,

        },

        destinationRow: {

          flexDirection: row,

          alignItems: 'center',

          gap: theme.spacing.sm,

          paddingHorizontal: theme.spacing.md,

          paddingVertical: theme.spacing.sm,

          borderRadius: theme.components.input.radius,

          borderWidth: 1,

          minHeight: 48,

        },

        destinationIconWrap: {

          width: 32,

          height: 32,

          borderRadius: 16,

          alignItems: 'center',

          justifyContent: 'center',

          flexShrink: 0,

        },

        destinationValue: {

          flex: 1,

          fontSize: theme.typographyScale.size.sm,

          fontWeight: '600',

        },

        catalogBlock: {

          gap: theme.spacing.xs,

          marginTop: theme.spacing.xs,

        },

        actions: {marginTop: 2, gap: theme.spacing.sm},

        confirmButton: {minHeight: 44, paddingVertical: 10},

      }),

    [row, theme],

  );



  return (

    <View style={styles.root}>

      <MirrorOrderCustomerFields

        customerName={customerName}

        onCustomerNameChange={onCustomerNameChange}

        fulfillmentType={fulfillmentType}

        onFulfillmentTypeChange={onFulfillmentTypeChange}

        showFulfillmentType={showFulfillmentType}

        fulfillmentTypeError={fulfillmentTypeError}

        customerNameError={customerNameError}

        customerPhoneError={customerPhoneError}

        customerPhone2Error={customerPhone2Error}

        customerLocationError={customerLocationError}

        customerPhone={customerPhone}

        onCustomerPhoneChange={onCustomerPhoneChange}

        customerPhone2={customerPhone2}

        onCustomerPhone2Change={onCustomerPhone2Change}

        showSecondPhone={showSecondPhone}

        customerLocation={customerLocation}

        onCustomerLocationChange={onCustomerLocationChange}

        customerNotes={customerNotes}

        onCustomerNotesChange={onCustomerNotesChange}

        customerPhotosLink={customerPhotosLink}

        onCustomerPhotosLinkChange={onCustomerPhotosLinkChange}

        showPhotosLink={showPhotosLink}

        collectedAmount={collectedAmount}

        onCollectedAmountChange={onCollectedAmountChange}

        fullPrice={fullPrice}

        onFullPriceChange={onFullPriceChange}

        fullPriceLocked={fullPriceLocked}

        remainingLabel={remainingLabel}

        pieceCount={pieceCount}

        onPieceCountChange={onPieceCountChange}

        showPieceCount

      />



      {showDestination && destinationLabel && onDestinationPress ? (

        <View style={styles.destinationBlock}>

          <Text style={[styles.destinationLabel, textStyle, {color: theme.typography.secondary}]}>

            {t('addOrderDestinationLabel')}

          </Text>

          <Pressable

            style={({pressed}) => [

              styles.destinationRow,

              {

                borderColor: theme.colors.inputBorder,

                backgroundColor: theme.colors.inputBackground,

                opacity: pressed ? 0.88 : 1,

              },

            ]}

            onPress={onDestinationPress}

            disabled={disabled}

            accessibilityRole="button"

            accessibilityLabel={t('addOrderDestinationLabel')}

          >

            <View

              style={[styles.destinationIconWrap, {backgroundColor: theme.colors.surfaceSecondary}]}

            >

              <MaterialCommunityIcons

                name="folder-move-outline"

                size={18}

                color={theme.colors.primary}

              />

            </View>

            <Text

              style={[styles.destinationValue, textStyle, {color: theme.typography.primary}]}

              numberOfLines={2}

            >

              {destinationLabel}

            </Text>

            <MaterialCommunityIcons name={chevronForward} size={18} color={theme.colors.icon} />

          </Pressable>

        </View>

      ) : null}



      {beforeCatalog}



      <View style={styles.catalogBlock}>

        <MirrorCatalogImagesEditor

          variant="addOrder"

          selectedIds={selectedCatalogImages}

          onChangeSelected={onChangeSelectedCatalogImages}

          annotationData={catalogAnnotationData}

          onChangeAnnotationData={onChangeCatalogAnnotationData}

          studioImageUrls={studioOrderImages}

          onChangeStudioUrls={onChangeStudioUrls}

          onAddStudioImages={onAddStudioImages}

          onReplaceStudioImage={onReplaceStudioImage}

          uploadingStudio={uploadingStudio}

          disabled={disabled}

        />

      </View>



      {afterInvoice}



      <View style={styles.actions}>

        <AppButton

          label={primaryActionLabel}

          onPress={onPrimaryAction}

          disabled={primaryActionDisabled}

          loading={primaryActionLoading}

          style={styles.confirmButton}

        />

      </View>

    </View>

  );

};



export default MirrorOrderFormSections;

