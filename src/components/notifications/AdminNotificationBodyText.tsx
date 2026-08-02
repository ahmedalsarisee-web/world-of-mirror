import React, {useMemo} from 'react';
import {StyleSheet, Text, type TextStyle} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import type {AdminNotificationRecord} from '@app/stores/adminNotificationStore';
import {
  getAdminNotificationActorHighlightStyle,
  getAdminNotificationNumberHighlightStyle,
  resolveAdminNotificationActorName,
  resolveFinanceNotificationAmountTone,
  splitTextByActorName,
  tokenizeNotificationNumbers,
} from '@app/utils/adminNotificationActorHighlight';

interface Props {
  item: AdminNotificationRecord;
  style?: TextStyle;
  numberOfLines?: number;
}

const AdminNotificationBodyText: React.FC<Props> = ({item, style, numberOfLines}) => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle} = useDirection();

  const actorName = useMemo(() => resolveAdminNotificationActorName(item), [item]);
  const highlightStyle = useMemo(() => getAdminNotificationActorHighlightStyle(theme), [theme]);
  const financeAmountTone = useMemo(() => resolveFinanceNotificationAmountTone(item), [item]);
  const financeAmountLabel = useMemo(() => {
    if (item.kind !== 'finance') {
      return undefined;
    }
    const label = item.metadata?.finance?.amountLabel?.trim();
    return label || undefined;
  }, [item]);
  const defaultNumberStyle = useMemo(
    () => getAdminNotificationNumberHighlightStyle(theme),
    [theme],
  );
  const financeAmountStyle = useMemo(
    () =>
      financeAmountTone
        ? getAdminNotificationNumberHighlightStyle(theme, financeAmountTone)
        : defaultNumberStyle,
    [defaultNumberStyle, financeAmountTone, theme],
  );
  const body = item.body.trim();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        actorPrefix: {
          marginBottom: 4,
        },
        actorLabel: {
          color: theme.typography.secondary,
        },
      }),
    [theme.typography.secondary],
  );

  if (!body && !actorName) {
    return null;
  }

  const renderTextSegment = (segment: string, keyPrefix: string) => {
    if (financeAmountLabel && financeAmountTone && segment.includes(financeAmountLabel)) {
      const amountParts = segment.split(financeAmountLabel);
      return amountParts.map((part, index) => (
        <React.Fragment key={`${keyPrefix}-amount-${index}`}>
          {renderPlainOrNumberSegment(part, `${keyPrefix}-pre-${index}`)}
          {index < amountParts.length - 1 ? (
            <Text key={`${keyPrefix}-amount-label-${index}`} style={[financeAmountStyle, inlineTextStyle]}>
              {financeAmountLabel}
            </Text>
          ) : null}
        </React.Fragment>
      ));
    }

    return renderPlainOrNumberSegment(segment, keyPrefix);
  };

  const renderPlainOrNumberSegment = (segment: string, keyPrefix: string) => {
    if (financeAmountTone) {
      return <React.Fragment key={keyPrefix}>{segment}</React.Fragment>;
    }

    return tokenizeNotificationNumbers(segment).map((token, index) => {
      if (token.kind === 'number') {
        return (
          <Text key={`${keyPrefix}-num-${index}`} style={[defaultNumberStyle, inlineTextStyle]}>
            {token.value}
          </Text>
        );
      }

      return <React.Fragment key={`${keyPrefix}-txt-${index}`}>{token.value}</React.Fragment>;
    });
  };

  const renderHighlightedName = (keyPrefix: string) =>
    actorName ? (
      <Text key={`${keyPrefix}-name`} style={[highlightStyle, inlineTextStyle]}>
        {actorName}
      </Text>
    ) : null;

  const renderBodyWithHighlight = () => {
    if (!body) {
      return null;
    }

    if (!actorName || !body.includes(actorName)) {
      return (
        <Text style={[style, textStyle]} numberOfLines={numberOfLines}>
          {renderTextSegment(body, 'body')}
        </Text>
      );
    }

    const parts = splitTextByActorName(body, actorName);
    return (
      <Text style={[style, textStyle]} numberOfLines={numberOfLines}>
        {parts.map((part, index) => (
          <React.Fragment key={`${index}-${part.slice(0, 12)}`}>
            {renderTextSegment(part, `body-${index}`)}
            {index < parts.length - 1 ? renderHighlightedName(`body-${index}`) : null}
          </React.Fragment>
        ))}
      </Text>
    );
  };

  const showActorPrefix = Boolean(actorName && (!body || !body.includes(actorName)));

  return (
    <>
      {showActorPrefix ? (
        <Text style={[styles.actorPrefix, style, textStyle]} numberOfLines={numberOfLines}>
          <Text style={[styles.actorLabel, inlineTextStyle]}>{t('notificationDetailActorLabel')} </Text>
          {renderHighlightedName('prefix')}
        </Text>
      ) : null}
      {renderBodyWithHighlight()}
    </>
  );
};

export default AdminNotificationBodyText;
