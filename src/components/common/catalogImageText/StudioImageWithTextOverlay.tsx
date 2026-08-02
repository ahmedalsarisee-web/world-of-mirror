import React, {useEffect, useMemo, useState} from 'react';

import {StyleSheet, View} from 'react-native';

import {Image} from 'expo-image';

import {useLanguage} from '@app/context/LangContext';

import {useDirection} from '@app/hooks/useDirection';

import CatalogImageTextOverlay from '@app/components/common/catalogImageText/CatalogImageTextOverlay';

import {

  CATALOG_IMAGE_COORDINATE_LAYER_STYLE,

  getCatalogImageLayout,

  isCatalogImageLayoutReady,

  isEmptyCatalogImageTextAnnotation,

  type CatalogImageTextAnnotation,

} from '@app/utils/catalogImageTextEditor';

import {getRemoteImageNaturalSize} from '@app/utils/catalogImageTextAnnotations';



interface Props {

  imageUri: string;

  imageKey: string;

  annotation?: CatalogImageTextAnnotation;

  width: number;

  height: number;

  borderRadius?: number;

  onCaptureReady?: () => void;

}



const StudioImageWithTextOverlayAnnotated: React.FC<Required<Pick<Props, 'annotation'>> & Props> = ({

  imageUri,

  imageKey,

  annotation,

  width,

  height,

  borderRadius = 0,

  onCaptureReady,

}) => {

  const {language} = useLanguage();

  const {appFont} = useDirection();

  const fontFamily = appFont('bold').fontFamily;

  const [naturalSize, setNaturalSize] = useState<{width: number; height: number} | null>(null);

  const [imageLoaded, setImageLoaded] = useState(false);



  useEffect(() => {

    let cancelled = false;

    setNaturalSize(null);

    void getRemoteImageNaturalSize(imageUri)

      .then((size) => {

        if (!cancelled) {

          setNaturalSize(size);

        }

      })

      .catch(() => {

        if (!cancelled) {

          setNaturalSize({width, height});

        }

      });

    return () => {

      cancelled = true;

    };

  }, [height, imageUri, width]);



  useEffect(() => {

    setImageLoaded(false);

  }, [annotation, imageKey, imageUri]);



  const layout = useMemo(() => {

    if (!naturalSize) {

      return null;

    }

    const nextLayout = getCatalogImageLayout(width, height, naturalSize.width, naturalSize.height);

    return isCatalogImageLayoutReady(nextLayout) ? nextLayout : null;

  }, [height, naturalSize, width]);



  useEffect(() => {

    if (imageLoaded) {

      onCaptureReady?.();

    }

  }, [imageLoaded, onCaptureReady]);



  if (!layout) {

    return (

      <View

        collapsable={false}

        style={[styles.root, {width, height, borderRadius, overflow: 'hidden'}]}

      >

        <Image

          recyclingKey={`studio-remote::${imageKey}`}

          source={{uri: imageUri}}

          style={{width, height}}

          contentFit="contain"

          cachePolicy="memory-disk"

          transition={0}

          onLoadEnd={() => setImageLoaded(true)}

        />

      </View>

    );

  }



  return (

    <View

      collapsable={false}

      style={[styles.root, CATALOG_IMAGE_COORDINATE_LAYER_STYLE, {width, height, borderRadius}]}

    >

      <View

        pointerEvents="none"

        collapsable={false}

        style={{

          position: 'absolute',

          left: layout.offsetX,

          top: layout.offsetY,

          width: layout.displayWidth,

          height: layout.displayHeight,

        }}

      >

        <Image

          recyclingKey={`studio-overlay::${imageKey}`}

          source={{uri: imageUri}}

          style={{width: layout.displayWidth, height: layout.displayHeight}}

          contentFit="contain"

          cachePolicy="memory-disk"

          transition={0}

          onLoadEnd={() => setImageLoaded(true)}

        />

        <View style={StyleSheet.absoluteFill} collapsable={false}>

          <CatalogImageTextOverlay

            layers={annotation.textLayers}

            layout={layout}

            fontFamily={fontFamily}

            language={language}

          />

        </View>

      </View>

    </View>

  );

};



const StudioImageWithTextOverlay: React.FC<Props> = (props) => {

  if (!props.annotation || isEmptyCatalogImageTextAnnotation(props.annotation)) {

    return (

      <View

        collapsable={false}

        style={[styles.root, {width: props.width, height: props.height, borderRadius: props.borderRadius, overflow: 'hidden'}]}

      >

        <Image

          recyclingKey={`studio-plain::${props.imageKey}`}

          source={{uri: props.imageUri}}

          style={{width: props.width, height: props.height}}

          contentFit="contain"

          cachePolicy="memory-disk"

          transition={0}

          onLoadEnd={() => props.onCaptureReady?.()}

        />

      </View>

    );

  }



  return <StudioImageWithTextOverlayAnnotated {...props} annotation={props.annotation} />;

};



const styles = StyleSheet.create({

  root: {

    overflow: 'hidden',

    backgroundColor: '#000',

    alignItems: 'center',

    justifyContent: 'center',

  },

});



export default StudioImageWithTextOverlay;


