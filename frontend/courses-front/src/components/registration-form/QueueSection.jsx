import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  fetchDefenseQueue,
  fetchDefenseQueueStatus,
  getJoinStartUrl,
  registerForDefenseQueue,
  shiftDefenseQueue,
  withdrawFromDefenseQueue,
} from "../../api";

// eslint-disable-next-line react/prop-types
export function QueueSection({ courseId, groupId, labId }) {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [shiftBy, setShiftBy] = useState(1);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const currentStatus = await fetchDefenseQueueStatus(courseId, groupId, labId);
      setStatus(currentStatus);
      const queueData = await fetchDefenseQueue(courseId, groupId, labId);
      setQueue(Array.isArray(queueData) ? queueData : queueData.queue || []);
    } catch (requestError) {
      setStatus(null);
      setQueue([]);
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, [courseId, groupId, labId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchDefenseQueueStatus(courseId, groupId, labId),
      fetchDefenseQueue(courseId, groupId, labId),
    ])
      .then(([currentStatus, queueData]) => {
        if (!active) return;
        setStatus(currentStatus);
        setQueue(Array.isArray(queueData) ? queueData : queueData.queue || []);
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setStatus(null);
        setQueue([]);
        setError(requestError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courseId, groupId, labId]);

  const performAction = async (action, successMessage) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(t(successMessage));
      await reload();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  };

  const formatSession = (session) => {
    if (!session || !session.starts_at) return null;
    const date = new Date(session.starts_at);
    if (Number.isNaN(date.getTime())) return session.starts_at;
    return new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const errorMessage = error
    ? error.code === "SESSION_REQUIRED" || error.status === 401
      ? null
      : error.code
        ? t(`queue.errors.${error.code}`, {
            defaultValue: error.message || t("queue.errors.generic"),
          })
        : error.message || t("queue.errors.generic")
    : null;

  return (
    <Paper component="section" variant="outlined" sx={{ mt: 3, p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">{t("queue.title")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("queue.description")}
          </Typography>
        </Box>

        {loading && (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">{t("queue.loading")}</Typography>
          </Stack>
        )}

        {!loading && error && (error.code === "SESSION_REQUIRED" || error.status === 401) && (
          <Alert
            severity="info"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => window.location.assign(getJoinStartUrl(courseId, labId))}
              >
                {t("queue.signIn")}
              </Button>
            }
          >
            {t("queue.signInRequired")}
          </Alert>
        )}

        {!loading && errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {notice && <Alert severity="success">{notice}</Alert>}

        {!loading && status && (
          <>
            {status.already_passed ? (
              <Alert severity="success">{t("queue.alreadyPassed")}</Alert>
            ) : status.in_queue ? (
              <Alert severity="info">
                {t("queue.position", {
                  position: status.position,
                  total: status.queue_size,
                })}
              </Alert>
            ) : status.queue_open === false ? (
              <Alert severity="warning">
                {t("queue.closed", {
                  nextSession:
                    formatSession(status.next_session) || t("queue.noNextSession"),
                })}
              </Alert>
            ) : status.ci_status === "not_run" ? (
              <Alert severity="info">{t("queue.ciNotRun")}</Alert>
            ) : status.ci_status === "failed" ? (
              <Alert severity="warning">{t("queue.ciFailed")}</Alert>
            ) : status.can_register ? (
              <Button
                variant="contained"
                disabled={busy}
                onClick={() =>
                  performAction(
                    () => registerForDefenseQueue(courseId, groupId, labId),
                    "queue.registered"
                  )
                }
              >
                {t(busy ? "queue.working" : "queue.register")}
              </Button>
            ) : null}

            {status.in_queue && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="flex-start">
                <Button
                  variant="outlined"
                  color="error"
                  disabled={busy}
                  onClick={() =>
                    performAction(
                      () => withdrawFromDefenseQueue(courseId, groupId, labId),
                      "queue.withdrawn"
                    )
                  }
                >
                  {t("queue.withdraw")}
                </Button>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    type="number"
                    size="small"
                    label={t("queue.shiftBy")}
                    value={shiftBy}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setShiftBy(Number.isInteger(value) && value > 0 ? value : "");
                    }}
                    inputProps={{ min: 1, step: 1 }}
                    sx={{ width: 130 }}
                  />
                  <Button
                    variant="outlined"
                    disabled={busy || !Number.isInteger(shiftBy) || shiftBy < 1}
                    onClick={() =>
                      performAction(
                        () => shiftDefenseQueue(courseId, groupId, labId, shiftBy),
                        "queue.shifted"
                      )
                    }
                  >
                    {t("queue.shift")}
                  </Button>
                </Stack>
              </Stack>
            )}

            {status.session && (
              <Typography variant="body2" color="text.secondary">
                {t("queue.session")}: {formatSession(status.session)}
                {status.session.room ? ` · ${status.session.room}` : ""}
              </Typography>
            )}

            <Box>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle1">{t("queue.listTitle")}</Typography>
                <Button size="small" disabled={busy} onClick={reload}>
                  {t("queue.refresh")}
                </Button>
              </Stack>
              {queue.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("queue.empty")}
                </Typography>
              ) : (
                <Stack component="ol" spacing={0.75} sx={{ m: 0, pl: 3 }}>
                  {queue.map((entry, index) => (
                    <li key={entry.id || `${entry.github || entry.fio || entry.name}-${index}`}>
                      <Typography variant="body2">
                        {entry.position || index + 1}. {entry.fio || entry.name || entry.title}
                      </Typography>
                    </li>
                  ))}
                </Stack>
              )}
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  );
}
