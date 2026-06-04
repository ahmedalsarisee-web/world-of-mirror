import React, {useCallback, useMemo} from 'react';
import {Alert, Linking, StyleSheet, Text, type TextStyle} from 'react-native';
import {useTranslation} from 'react-i18next';
import {splitTextWithLinks} from '@app/utils/linkableText';

interface Props {
  text: string;
  style?: TextStyle;
  linkStyle?: TextStyle;
  numberOfLines?: number;
}

const LinkableText: React.FC<Props> = ({text, style, linkStyle, numberOfLines}) => {
  const {t} = useTranslation();
  const segments = useMemo(() => splitTextWithLinks(text), [text]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        link: {
          color: '#2563EB',
          textDecorationLine: 'underline',
          fontWeight: '600',
        },
      }),
    [],
  );

  const openLink = useCallback(
    async (url: string) => {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          Alert.alert(t('error'), t('linkOpenFailed'));
          return;
        }
        await Linking.openURL(url);
      } catch {
        Alert.alert(t('error'), t('linkOpenFailed'));
      }
    },
    [t],
  );

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((segment, index) => {
        if (segment.type === 'link') {
          return (
            <Text
              key={`${segment.url}-${index}`}
              style={[style, styles.link, linkStyle]}
              onPress={() => void openLink(segment.url)}
              accessibilityRole="link"
            >
              {segment.value}
            </Text>
          );
        }

        return <Text key={`text-${index}`}>{segment.value}</Text>;
      })}
    </Text>
  );
};

export default LinkableText;
