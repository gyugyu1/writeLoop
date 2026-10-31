"use client";

import styles from "../../app/page.module.css";
import { getMonthStatusDayStyle, WEEKDAY_LABELS } from "../../lib/writing-calendar";
import { StreakSparkleEffect } from "../streak-sparkle-effect";
import type { MonthStatusState } from "./use-month-status";

type MonthStatusModalProps = {
  monthStatus: MonthStatusState;
  // 기록이 있는 날을 누르면 모달을 닫은 뒤 부른다.
  onSelectDate: (dateKey: string) => void;
};

// 웹 주 화면의 월 학습 현황(전체 이력 달력) 모달.
export function MonthStatusModal({ monthStatus, onSelectDate }: MonthStatusModalProps) {
  if (!monthStatus.isVisible) {
    return null;
  }

  const { calendar: monthCalendar, streakDays, isCurrentMonth: isCurrentMonthView } = monthStatus;

  return (
    <div className={styles.monthStatusOverlay} onClick={monthStatus.close}>
      <section
        className={styles.monthStatusDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="month-status-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.monthStatusClose}
          ref={monthStatus.closeButtonRef}
          aria-label="학습 캘린더 닫기"
          onClick={monthStatus.close}
        >
          ×
        </button>
        <div className={styles.monthStatusCopy}>
          <div className={styles.monthStatusBadge}>전체 이력 달력</div>
          <h2 id="month-status-title">학습 캘린더</h2>
          <div className={styles.monthStatusMonthRail} aria-label="달 이동">
            <button
              type="button"
              className={styles.monthStatusNavButton}
              aria-label="이전 달 보기"
              onClick={() => monthStatus.moveMonth(-1)}
            >
              ‹
            </button>
            <div className={styles.monthStatusMonthDisplay} aria-live="polite">
              <span className={styles.monthStatusMonthYear}>{monthCalendar.year}</span>
              <strong className={styles.monthStatusMonthValue}>{monthCalendar.month}</strong>
            </div>
            <button
              type="button"
              className={styles.monthStatusNavButton}
              aria-label={isCurrentMonthView ? "다음 달은 아직 볼 수 없어요" : "다음 달 보기"}
              onClick={() => monthStatus.moveMonth(1)}
              disabled={isCurrentMonthView}
            >
              ›
            </button>
          </div>
          <div className={styles.monthStatusSummary}>
            <div className={styles.monthStatusSummaryItem}>
              <div className={styles.monthStatusSummaryCard}>
                <StreakSparkleEffect
                  className={styles.monthStatusSummarySparkleLayer}
                  streakDays={streakDays}
                />
                <div className={styles.monthStatusSummaryCopy}>
                  <span>현재 연속 학습일</span>
                  <strong>{streakDays}일</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.monthStatusBody}>
          {monthStatus.isLoading ? (
            <div className={styles.monthStatusStatePanel}>
              <strong>달력을 불러오는 중이에요.</strong>
              <p>선택한 달의 학습 흐름을 정리하고 있어요. 잠시만 기다려 주세요.</p>
            </div>
          ) : monthStatus.error ? (
            <div className={styles.monthStatusStatePanel}>
              <strong>달력을 불러오지 못했어요.</strong>
              <p>{monthStatus.error}</p>
            </div>
          ) : (
            <>
              <div className={styles.monthStatusWeekdays} aria-hidden="true">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className={styles.monthStatusCalendar} aria-label={`${monthCalendar.monthLabel} 달력`}>
                {monthCalendar.cells.map((cell, index) =>
                  cell ? (
                    (() => {
                      const statusLabel = cell.status?.completed
                        ? cell.status.isToday
                          ? "오늘 완료"
                          : "완료"
                        : cell.status?.started
                          ? cell.status.isToday
                            ? "오늘 진행 중"
                            : "진행 중"
                          : cell.status?.isToday
                            ? "오늘"
                            : cell.isFuture
                              ? ""
                              : "기록 없음";
                      const visibleStatusLabel = statusLabel === "기록 없음" ? "" : statusLabel;
                      const canOpenHistory = Boolean(cell.status?.started || cell.status?.completed);
                      const className = `${styles.monthStatusDay} ${
                        cell.status?.completed ? styles.monthStatusDayCompleted : ""
                      } ${cell.status?.started && !cell.status.completed ? styles.monthStatusDayStarted : ""} ${
                        cell.status?.isToday ? styles.monthStatusDayToday : ""
                      } ${cell.isFuture ? styles.monthStatusDayFuture : ""} ${
                        !cell.status && !cell.isFuture ? styles.monthStatusDayIdle : ""
                      } ${canOpenHistory ? styles.monthStatusDayInteractive : ""}`;

                      if (canOpenHistory) {
                        return (
                          <button
                            key={cell.key}
                            type="button"
                            className={className}
                            style={getMonthStatusDayStyle(cell)}
                            aria-label={`${monthCalendar.monthLabel} ${cell.dayNumber}일, ${statusLabel} 기록 보기`}
                            onClick={() => {
                              monthStatus.close();
                              onSelectDate(cell.key);
                            }}
                          >
                            <span className={styles.monthStatusDayHeader}>
                              <span className={styles.monthStatusDayNumber}>{cell.dayNumber}</span>
                            </span>
                            {visibleStatusLabel ? (
                              <span className={styles.monthStatusDayState}>{visibleStatusLabel}</span>
                            ) : null}
                          </button>
                        );
                      }

                      return (
                        <div
                          key={cell.key}
                          className={className}
                          style={getMonthStatusDayStyle(cell)}
                          aria-label={`${monthCalendar.monthLabel} ${cell.dayNumber}일, ${statusLabel}`}
                        >
                          <span className={styles.monthStatusDayHeader}>
                            <span className={styles.monthStatusDayNumber}>{cell.dayNumber}</span>
                          </span>
                          {visibleStatusLabel ? (
                            <span className={styles.monthStatusDayState}>{visibleStatusLabel}</span>
                          ) : null}
                        </div>
                      );
                    })()
                  ) : (
                    <span key={`month-empty-${index}`} className={styles.monthStatusEmptyCell} aria-hidden="true" />
                  )
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
