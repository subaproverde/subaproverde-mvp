import { HStack, Text, VStack } from "@expo/ui/swift-ui";
import { containerBackground, font, foregroundStyle, lineLimit, privacySensitive, widgetURL } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type RadarProps = {
  signedIn: boolean; stale: boolean; updatedLabel: string;
  today: number; overdue: number; waiting: number;
  tasks: { title: string; time: string }[];
};

const Radar = (props: RadarProps, environment: WidgetEnvironment) => {
  "widget";
  const compact = environment.widgetFamily === "accessoryInline" || environment.widgetFamily === "accessoryRectangular";
  const ink = environment.colorScheme === "dark" ? "#edf9f1" : "#123329";
  if (!props.signedIn) return <VStack modifiers={[widgetURL("radarspv:///"), containerBackground(environment.colorScheme === "dark" ? "#09251c" : "#eaf5ef", "widget")]}><Text>Radar SPV</Text><Text>Abra o app e entre na sua conta.</Text></VStack>;
  if (compact) return <VStack alignment="leading" modifiers={[widgetURL("radarspv:///"), privacySensitive()]}><Text modifiers={[font({ size: 12, weight: "bold" }), lineLimit(1)]}>{props.stale ? "Abra para atualizar" : `${props.today} hoje · ${props.overdue} atrasados`}</Text><Text modifiers={[font({ size: 11 }), lineLimit(1)]}>{props.updatedLabel}</Text></VStack>;
  return <VStack alignment="leading" spacing={8} modifiers={[widgetURL("radarspv:///"), privacySensitive(), containerBackground(environment.colorScheme === "dark" ? "#09251c" : "#eaf5ef", "widget")]}>
    <Text modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle(ink)]}>RADAR SPV</Text>
    <HStack spacing={12}>
      <Text modifiers={[font({ size: 18, weight: "bold" }), foregroundStyle(ink)]}>{props.today} hoje</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(props.overdue ? "#bc4936" : ink)]}>{props.overdue} atrasados</Text>
    </HStack>
    {environment.widgetFamily !== "systemSmall" && <Text modifiers={[font({ size: 12 }), foregroundStyle(ink)]}>{props.waiting} conversas precisam de você</Text>}
    {props.tasks.slice(0, environment.widgetFamily === "systemLarge" ? 4 : 1).map((task, index) => <VStack key={index} alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 11, weight: "semibold" }), foregroundStyle(ink)]}>{task.time}</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(ink), lineLimit(2)]}>{task.title}</Text>
    </VStack>)}
    <Text modifiers={[font({ size: 10 }), foregroundStyle(ink), lineLimit(2)]}>{props.stale ? "Dados antigos · abra para atualizar" : props.updatedLabel}</Text>
  </VStack>;
};

export default createWidget("RadarWidget", Radar);
