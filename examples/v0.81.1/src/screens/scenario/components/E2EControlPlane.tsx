import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Pressable, Text, View } from "react-native";
import type { GestureResponderEvent, TextProps } from "react-native";
import { sharedStyles } from "../styles";

type E2EAction = {
  disabled?: boolean;
  id: string;
  onPress: (event: GestureResponderEvent) => void;
  title: string;
};

type E2EActionInfo = Omit<E2EAction, "onPress">;

type E2EDumpNode = {
  id?: string;
  text: string;
};

type E2EControlContextValue = {
  registerAction: (action: E2EAction) => () => void;
  registerDumpNode: (node: E2EDumpNode) => () => void;
};

const E2EControlContext = createContext<E2EControlContextValue | null>(null);

function normalizeActionId(testID: string | undefined, title: string) {
  if (testID) return `e2e-action-${testID}`;

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `e2e-action-${slug || "button"}`;
}

function nodeKey(node: E2EDumpNode) {
  return node.id ?? `text:${node.text}`;
}

function actionInfoChanged(
  current: E2EActionInfo | undefined,
  next: E2EActionInfo
) {
  return (
    !current ||
    current.title !== next.title ||
    current.disabled !== next.disabled
  );
}

export type E2EControlPlaneProviderProps = {
  children: React.ReactNode;
};

export function E2EControlPlaneProvider({
  children
}: E2EControlPlaneProviderProps) {
  const actionRefs = useRef(new Map<string, E2EAction>());
  const dumpRefs = useRef(new Map<string, E2EDumpNode>());
  const [actions, setActions] = useState<E2EActionInfo[]>([]);
  const [dumpNodes, setDumpNodes] = useState<E2EDumpNode[]>([]);

  const registerAction = useCallback((action: E2EAction) => {
    actionRefs.current.set(action.id, action);
    setActions((current) => {
      const existingIndex = current.findIndex((item) => item.id === action.id);
      const nextInfo = {
        disabled: action.disabled,
        id: action.id,
        title: action.title
      };

      if (existingIndex === -1) return [...current, nextInfo];
      if (!actionInfoChanged(current[existingIndex], nextInfo)) return current;

      const next = [...current];
      next[existingIndex] = nextInfo;
      return next;
    });

    return () => {
      actionRefs.current.delete(action.id);
      setActions((current) => current.filter((item) => item.id !== action.id));
    };
  }, []);

  const registerDumpNode = useCallback((node: E2EDumpNode) => {
    const key = nodeKey(node);
    dumpRefs.current.set(key, node);
    setDumpNodes((current) => {
      const existingIndex = current.findIndex((item) => nodeKey(item) === key);
      if (existingIndex === -1) return [...current, node];
      if (current[existingIndex].text === node.text) return current;

      const next = [...current];
      next[existingIndex] = node;
      return next;
    });

    return () => {
      dumpRefs.current.delete(key);
      setDumpNodes((current) =>
        current.filter((item) => nodeKey(item) !== key)
      );
    };
  }, []);

  const value = useMemo(
    () => ({
      registerAction,
      registerDumpNode
    }),
    [registerAction, registerDumpNode]
  );

  return (
    <E2EControlContext.Provider value={value}>
      <View style={sharedStyles.e2eControlPlane} testID="e2e-control-plane">
        {actions.length > 0 ? (
          <View style={sharedStyles.e2eActionBar} testID="e2e-action-bar">
            {actions.map((action) => (
              <Pressable
                key={action.id}
                accessibilityRole="button"
                disabled={action.disabled}
                onPress={(event) =>
                  actionRefs.current.get(action.id)?.onPress(event)
                }
                style={[
                  sharedStyles.e2eAction,
                  action.disabled && sharedStyles.e2eActionDisabled
                ]}
                testID={action.id}
              >
                <Text style={sharedStyles.e2eActionText}>{action.title}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {dumpNodes.length > 0 ? (
          <View
            accessible={false}
            style={sharedStyles.e2eDump}
            testID="e2e-state-dump"
          >
            {dumpNodes.map((node) => (
              <Text
                key={nodeKey(node)}
                accessibilityLabel={node.text}
                style={sharedStyles.e2eDumpText}
                testID={node.id}
              >
                {node.text}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      {children}
    </E2EControlContext.Provider>
  );
}

export function createE2EActionId(testID: string | undefined, title: string) {
  return normalizeActionId(testID, title);
}

export function useE2EAction(
  title: string,
  onPress: (event: GestureResponderEvent) => void,
  testID?: string,
  disabled?: boolean
) {
  const context = useContext(E2EControlContext);
  const id = normalizeActionId(testID, title);
  const onPressRef = useRef(onPress);

  onPressRef.current = onPress;

  useEffect(() => {
    if (!context) return;

    return context.registerAction({
      disabled,
      id,
      onPress: (event) => onPressRef.current(event),
      title
    });
  }, [context, disabled, id, title]);
}

export function useE2EDumpNode(text: string | null | undefined, id?: string) {
  const context = useContext(E2EControlContext);

  useEffect(() => {
    if (!context || !text) return;

    return context.registerDumpNode({
      id,
      text
    });
  }, [context, id, text]);
}

export type DumpedTextProps = TextProps & {
  dumpText?: string;
};

export function DumpedText({
  children,
  dumpText,
  testID,
  ...textProps
}: DumpedTextProps) {
  const childText =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : undefined;

  useE2EDumpNode(dumpText ?? childText, testID);

  return (
    <Text {...textProps} testID={testID}>
      {children}
    </Text>
  );
}
