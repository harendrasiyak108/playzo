import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ChipRow } from "@/src/components/ChipRow";
import { colors, spacing, radius, statusColor, stationTypeIcon } from "@/src/theme";
import { api, Station, money } from "@/src/api";
import { computeLiveCost, formatDuration, useNow } from "@/src/hooks/useNow";

type Filter = "all" | "pc" | "console" | "table";

export default function StationsScreen() {
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [sessionMap, setSessionMap] = useState<Record<string, { start: string; rate: number; sid: string; customer: string }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const now = useNow(1000);

  const load = useCallback(async () => {
    try {
      const [s, active] = await Promise.all([api.listStations(), api.activeSessions()]);
      setStations(s);
      const map: typeof sessionMap = {};
      for (const sess of active) {
        map[sess.station_id] = {
          start: sess.start_time,
          rate: sess.hourly_rate,
          sid: sess.id,
          customer: sess.customer_name,
        };
      }
      setSessionMap(map);
    } catch (e) {
      console.log("stations load error", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered = stations.filter((s) => filter === "all" || s.type === filter);
  const occupied = stations.filter((s) => s.status === "occupied").length;
  const available = stations.filter((s) => s.status === "available").length;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Playzo Ops"
        subtitle={`${available} available · ${occupied} in play`}
        right={
          <Pressable
            testID="add-station-btn"
            onPress={() => router.push("/modal/station-form")}
            style={styles.headerBtn}
          >
            <Ionicons name="add" size={22} color={colors.onBrand} />
          </Pressable>
        }
      />
      <ChipRow
        testIDPrefix="stations-filter"
        options={[
          { key: "all", label: "All" },
          { key: "pc", label: "PC" },
          { key: "console", label: "Console" },
          { key: "table", label: "Table" },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="desktop-outline" size={48} color={colors.onSurfaceTertiary} />
          <Text style={styles.emptyText}>No stations. Tap + to add one.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.sm }}
          refreshControl={
            <RefreshControl refreshing={refreshing} tintColor={colors.brand} onRefresh={() => { setRefreshing(true); load(); }} />
          }
          renderItem={({ item }) => (
            <StationCard
              station={item}
              live={sessionMap[item.id]}
              now={now}
              onPress={() => {
                if (item.status === "occupied" && sessionMap[item.id]) {
                  router.push({ pathname: "/modal/session-detail", params: { sessionId: sessionMap[item.id].sid } });
                } else if (item.status === "available") {
                  router.push({ pathname: "/modal/start-session", params: { stationId: item.id } });
                } else {
                  router.push({ pathname: "/modal/station-form", params: { stationId: item.id } });
                }
              }}
              onEdit={() => router.push({ pathname: "/modal/station-form", params: { stationId: item.id } })}
            />
          )}
        />
      )}
    </View>
  );
}

function StationCard({
  station,
  live,
  now,
  onPress,
  onEdit,
}: {
  station: Station;
  live?: { start: string; rate: number; sid: string; customer: string };
  now: number;
  onPress: () => void;
  onEdit: () => void;
}) {
  const border = statusColor(station.status);
  const { ms, cost } = live ? computeLiveCost(live.start, live.rate, now) : { ms: 0, cost: 0 };

  return (
    <View style={styles.cardWrap}>
      <Pressable
        testID={`station-card-${station.name}`}
        onPress={onPress}
        style={[styles.card, { borderTopColor: border }]}
      >
        <View style={styles.nameRow}>
          <Text style={{ fontSize: 18 }}>{stationTypeIcon(station.type)}</Text>
          <Text style={styles.stationName} numberOfLines={1}>{station.name}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: border + "22", borderColor: border }]}>
          <Text style={[styles.pillText, { color: border }]}>{station.status.toUpperCase()}</Text>
        </View>

        {live ? (
          <>
            <Text style={styles.customer} numberOfLines={1}>{live.customer}</Text>
            <Text style={styles.timer} testID={`timer-${station.name}`}>{formatDuration(ms)}</Text>
            <Text style={styles.costLive}>{money(cost)}</Text>
          </>
        ) : (
          <>
            <Text style={styles.rateLabel}>Hourly</Text>
            <Text style={styles.rateValue}>{money(station.hourly_rate)}</Text>
          </>
        )}
      </Pressable>
      <Pressable
        testID={`edit-station-${station.name}`}
        onPress={onEdit}
        style={styles.editBadge}
        hitSlop={10}
      >
        <Ionicons name="pencil" size={12} color={colors.onSurface} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  emptyText: { color: colors.onSurfaceTertiary, marginTop: spacing.sm },
  headerBtn: {
    backgroundColor: colors.brand,
    height: 40,
    width: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 150,
  },
  cardWrap: { flex: 1, position: "relative" },
  editBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 28 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stationName: {
    color: colors.onSurface,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  pill: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  customer: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: spacing.sm },
  timer: {
    color: colors.brand,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  costLive: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700", marginTop: 2 },
  rateLabel: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: spacing.md, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  rateValue: { color: colors.brand, fontSize: 22, fontWeight: "900", letterSpacing: 1 },
});
