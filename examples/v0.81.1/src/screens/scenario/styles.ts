import { StyleSheet } from "react-native";

/**
 * Shared visual language for native E2E contract screens.
 *
 * Prefer the scenario components over direct style access in screen files.
 * Reach for this object only when building a small one-off label or composing
 * a new scenario component.
 *
 * @example
 * ```tsx
 * <Text style={sharedStyles.resultStatus} testID="provider-readiness-contract">
 *   Provider readiness: ready
 * </Text>
 * ```
 */
export const sharedStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F9FC"
  },
  header: {
    backgroundColor: "#111827",
    padding: 20,
    paddingTop: 56
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700"
  },
  subtitle: {
    color: "#D1D5DB",
    fontSize: 15,
    marginTop: 8
  },
  section: {
    padding: 20
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12
  },
  description: {
    color: "#4B5563",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14
  },
  divider: {
    backgroundColor: "#E5E7EB",
    height: 1,
    marginHorizontal: 20
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 8
  },
  button: {
    flex: 1
  },
  buttonContainer: {
    marginBottom: 12
  },
  toggleContainer: {
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 12
  },
  toggleLabel: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700"
  },
  statusContainer: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 12
  },
  statusStackContainer: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },
  statusStackRow: {
    marginBottom: 8
  },
  statusStackRowLast: {
    marginBottom: 0
  },
  statusLabel: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "700",
    marginRight: 8
  },
  statusValue: {
    color: "#111827",
    flex: 1,
    fontSize: 15
  },
  errorContainer: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12
  },
  errorText: {
    color: "#991B1B",
    fontSize: 14,
    lineHeight: 20
  },
  positionContainer: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 14
  },
  positionTitle: {
    color: "#065F46",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8
  },
  positionText: {
    color: "#064E3B",
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 1
  },
  resultContainer: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 14
  },
  resultPassed: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981"
  },
  resultFailed: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444"
  },
  resultStatus: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6
  },
  resultMessage: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 20
  },
  scenarioContainer: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    padding: 12
  },
  scenarioTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4
  },
  scenarioText: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 20
  }
});
