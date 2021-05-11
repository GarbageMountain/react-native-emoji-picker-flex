import AsyncStorage from '@react-native-async-storage/async-storage';
import emoji from 'emoji-datasource';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  View,
  Text,
  TextInput,
} from 'react-native';
import { seaq } from 'seaq';

const Layout = {
  Row: View,
  Column: View,
  PressableRow: Pressable,
  PressableColumn: Pressable,
  FlatList: FlatList,
};

export const charFromUtf16 = (utf16: any) =>
  String.fromCodePoint(...utf16.split('-').map((u: any) => '0x' + u));

export const Categories = {
  all: {
    symbol: 'All',
    name: 'All',
  },
  history: {
    symbol: '🕘',
    name: 'Recently used',
  },
  emotion: {
    symbol: '😀',
    name: 'Smileys & Emotion',
  },
  people: {
    symbol: '🧑',
    name: 'People & Body',
  },
  nature: {
    symbol: '🦄',
    name: 'Animals & Nature',
  },
  food: {
    symbol: '🍔',
    name: 'Food & Drink',
  },
  activities: {
    symbol: '⚾️',
    name: 'Activities',
  },
  places: {
    symbol: '✈️',
    name: 'Travel & Places',
  },
  objects: {
    symbol: '💡',
    name: 'Objects',
  },
  symbols: {
    symbol: '🔣',
    name: 'Symbols',
  },
  flags: {
    symbol: '🏳️‍🌈',
    name: 'Flags',
  },
} as const;

type CategoryName = keyof typeof Categories;
type Emoji = typeof emoji[number];
export const charFromEmojiObject = (obj: Emoji) => charFromUtf16(obj.unified);
const filteredEmojis = emoji.filter(e => !e['obsoleted_by']);
const emojiByCategory = (category: CategoryName) =>
  filteredEmojis.filter(e => e.category === Categories[category].name);
const sortEmoji = (list: Emoji[]) =>
  list.sort((a, b) => a.sort_order - b.sort_order);
const categoryKeys = Object.keys(Categories) as CategoryName[];

const KeyedSortedEmojis = categoryKeys.reduce(
  (acc, curr) => {
    return { ...acc, [curr]: sortEmoji(emojiByCategory(curr)) };
  },
  {} as {
    [Property in keyof typeof Categories]: Emoji[];
  }
);

const FullEmojiList = categoryKeys.reduce((acc, curr) => {
  return [...acc, ...sortEmoji(emojiByCategory(curr))];
}, [] as Emoji[]);

const TabBar: React.FC<{
  theme: string;
  activeCategory: CategoryName;
  onPress: (category: CategoryName) => void;
  width: number;
}> = ({ theme, activeCategory, onPress, width }) => {
  const tabSize = width / categoryKeys.length;

  return (
    <Layout.Row>
      {categoryKeys.map(c => {
        const category = Categories[c as CategoryName];
        return (
          <Layout.PressableColumn
            key={category.name}
            onPress={() => onPress(c)}
            style={{
              flex: 1,
              height: tabSize,
              borderColor: c === activeCategory ? theme : 'transparent',
              borderBottomWidth: 2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                paddingBottom: 8,
                fontSize: tabSize - 16,
              }}
            >
              {category.symbol}
            </Text>
          </Layout.PressableColumn>
        );
      })}
    </Layout.Row>
  );
};

const EmojiCell: React.FC<{
  emoji: Emoji;
  colSize: number;
  onPress: (emoji: Emoji) => void;
}> = ({ emoji, colSize, onPress }) => (
  <Layout.PressableColumn
    style={{
      width: colSize,
      height: colSize,
      alignItems: 'center',
      justifyContent: 'center',
    }}
    onPress={() => onPress(emoji)}
  >
    <Text style={{ fontSize: colSize - 12 }}>{charFromEmojiObject(emoji)}</Text>
  </Layout.PressableColumn>
);

const storage_key = '@react-native-emoji-selector:HISTORY';

export const EmojiPicker: React.FC<{
  showHistory?: boolean;
  onEmojiSelected: (emoji: string) => void;
  theme?: string;
  columns?: number;
}> = props => {
  const [state, setState] = React.useState({
    searchQuery: '',
    category: 'all' as CategoryName,
    isReady: false,
    history: [] as Emoji[],
    colSize: 0,
    width: 0,
  });

  const scrollview = React.useRef<FlatList>(null);

  const handleTabSelect = (category: CategoryName) => {
    if (state.isReady) {
      scrollview.current?.scrollToOffset({ offset: 0, animated: false });
      setState(state => ({
        ...state,
        searchQuery: '',
        category,
      }));
    }
  };

  const handleEmojiSelect = (emoji: Emoji) => {
    addToHistoryAsync(emoji);
    props.onEmojiSelected(charFromEmojiObject(emoji));
  };

  const handleSearch = (searchQuery: string) => {
    setState(state => ({ ...state, searchQuery }));
  };

  const addToHistoryAsync = async (emoji: Emoji) => {
    const history = await AsyncStorage.getItem(storage_key);

    let value: Emoji[] = [];
    if (!history) {
      // no history
      value.push(emoji);
    } else {
      const json: Emoji[] = JSON.parse(history);
      value = [emoji, ...json.filter(r => r.unified !== emoji.unified)];
    }

    AsyncStorage.setItem(storage_key, JSON.stringify(value));
    setState(state => ({ ...state, history: value }));
  };

  const loadHistoryAsync = async () => {
    const result = await AsyncStorage.getItem(storage_key);
    if (result) {
      const history: Emoji[] = JSON.parse(result);
      setState(state => ({ ...state, history }));
    }
  };

  const renderEmojiCell = ({
    item,
  }: {
    item: { key: string; emoji: Emoji };
  }) => (
    <EmojiCell
      key={item.key}
      emoji={item.emoji}
      onPress={() => handleEmojiSelect(item.emoji)}
      colSize={state.colSize}
    />
  );

  const returnSectionData = () => {
    const { history, searchQuery, category } = state;

    const emojiData = searchQuery
      ? seaq(FullEmojiList, searchQuery, ['short_names'])
      : category === 'all'
      ? FullEmojiList
      : category === 'history'
      ? history
      : KeyedSortedEmojis[category];
    return emojiData.map(emoji => ({ key: emoji.unified, emoji }));
  };

  React.useEffect(() => {
    loadHistoryAsync();
  }, []);

  React.useEffect(() => {
    if (state.width > 0) {
      setState(state => ({
        ...state,
        colSize: Math.floor(state.width / (props.columns ?? 6)),
        isReady: true,
      }));
    }
  }, [state.width]);

  const { theme, columns = 6 } = props;

  const { category, colSize, isReady, searchQuery } = state;

  const title =
    searchQuery !== '' ? 'Search Results' : Categories[category].name;

  return (
    <Layout.Column style={{ flex: 1 }}>
      <TabBar
        activeCategory={category}
        onPress={handleTabSelect}
        theme={theme ?? '#777'}
        width={state.width}
      />
      <Layout.Column
        style={{ flex: 1 }}
        onLayout={({ nativeEvent: { layout } }) => {
          setState(state => ({ ...state, width: layout.width }));
        }}
      >
        <Layout.Column>
          <Layout.Column>
            <Layout.Row>
              <TextInput
                placeholder="Search..."
                clearButtonMode="always"
                returnKeyType="done"
                autoCorrect={false}
                underlineColorAndroid={theme}
                value={searchQuery}
                onChangeText={handleSearch}
              />
            </Layout.Row>
          </Layout.Column>
          <Text>{title}</Text>
        </Layout.Column>
        {isReady ? (
          <Layout.Column style={{ flex: 1 }}>
            <Layout.Column
              style={{
                flexWrap: 'wrap',
                alignItems: 'flex-start',
              }}
            >
              <Layout.FlatList
                contentContainerStyle={{ paddingBottom: colSize }}
                data={returnSectionData()}
                renderItem={renderEmojiCell}
                horizontal={false}
                numColumns={columns}
                keyboardShouldPersistTaps="always"
                ref={scrollview}
                removeClippedSubviews
                showsVerticalScrollIndicator
              />
            </Layout.Column>
          </Layout.Column>
        ) : (
          <Layout.Column style={{ flex: 1 }}>
            <ActivityIndicator
              size="large"
              color={Platform.OS === 'android' ? theme : '#000000'}
            />
          </Layout.Column>
        )}
      </Layout.Column>
    </Layout.Column>
  );
};
