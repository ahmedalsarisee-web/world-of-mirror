import React from 'react';
import type {LangCode} from '@app/types/language';
import CatalogImageTextBubble from '@app/components/common/catalogImageText/CatalogImageTextBubble';
import {isCatalogImageLayoutReady, type CatalogImageLayout, type CatalogImageTextLayer} from '@app/utils/catalogImageTextEditor';

interface Props {
  layers: CatalogImageTextLayer[];
  layout: CatalogImageLayout;
  fontFamily?: string;
  language: LangCode;
}

const CatalogImageTextOverlay: React.FC<Props> = ({layers, layout, fontFamily, language}) => {
  if (!isCatalogImageLayoutReady(layout)) {
    return null;
  }

  return (
    <>
      {layers.map((layer) => (
        <CatalogImageTextBubble
          key={layer.id}
          layer={layer}
          layout={layout}
          language={language}
          fontFamily={fontFamily}
        />
      ))}
    </>
  );
};

export default CatalogImageTextOverlay;
