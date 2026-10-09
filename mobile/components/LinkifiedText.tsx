import { Linking, Text, type TextProps, type TextStyle } from 'react-native';
import { useMemo, type ReactElement } from 'react';
import { useThemeColors } from '@/lib/useThemeColors';

const URL_PATTERN = /(https?:\/\/[^\s<>"')]+|www\.[^\s<>"')]+)/g;

type Props = TextProps & {
  text: string;
  linkStyle?: TextStyle;
};

// Renders text with embedded URLs as tappable links — only the URL itself is
// linked, never the surrounding content. Used for event descriptions, vendor
// details, and any user/backend-provided free text.
export function LinkifiedText({ text, linkStyle, style, ...rest }: Props) {
  const colors = useThemeColors();
  const parts = useMemo(() => {
    const pattern = new RegExp(URL_PATTERN);
    const nodes: (string | ReactElement)[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > last) nodes.push(text.slice(last, match.index));
      const raw = match[0];
      const href = raw.startsWith('http') ? raw : `https://${raw}`;
      nodes.push(
        <Text
          key={`link-${key++}`}
          accessibilityRole="link"
          style={[{ color: colors.brand, textDecorationLine: 'underline' }, linkStyle]}
          onPress={() => void Linking.openURL(href)}
          suppressHighlighting={false}
        >
          {raw}
        </Text>,
      );
      last = match.index + raw.length;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
  }, [text, colors.brand, linkStyle]);

  return (
    <Text style={style} {...rest}>
      {parts}
    </Text>
  );
}
