"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createAdminPrompt,
  createAdminPromptHint,
  deleteAdminPrompt,
  deleteAdminPromptHint,
  getAdminPrompts,
  getCurrentUser,
  updateAdminPrompt,
  updateAdminPromptHint
} from "../lib/api";
import type {
  AdminPrompt,
  AdminPromptHint,
  AdminPromptHintRequest,
  AdminPromptRequest,
  AuthUser,
  PromptDifficulty
} from "../lib/types";
import authStyles from "./auth-page.module.css";
import styles from "./admin-page.module.css";

const difficultyOptions: PromptDifficulty[] = ["A", "B", "C"];

const emptyPromptForm: AdminPromptRequest = {
  topic: "",
  difficulty: "A",
  questionEn: "",
  questionKo: "",
  tip: "",
  displayOrder: 0,
  active: true
};

const emptyHintForm: AdminPromptHintRequest = {
  hintType: "STARTER",
  content: "",
  displayOrder: 0,
  active: true
};

function toPromptForm(prompt: AdminPrompt): AdminPromptRequest {
  return {
    topic: prompt.topic,
    difficulty: prompt.difficulty,
    questionEn: prompt.questionEn,
    questionKo: prompt.questionKo,
    tip: prompt.tip,
    displayOrder: prompt.displayOrder,
    active: prompt.active
  };
}

function toHintForm(hint: AdminPromptHint): AdminPromptHintRequest {
  return {
    hintType: hint.hintType,
    content: hint.content,
    displayOrder: hint.displayOrder,
    active: hint.active
  };
}

export function AdminPageClient() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null | undefined>(undefined);
  const [prompts, setPrompts] = useState<AdminPrompt[]>([]);
  const [promptForms, setPromptForms] = useState<Record<string, AdminPromptRequest>>({});
  const [hintForms, setHintForms] = useState<Record<string, AdminPromptHintRequest>>({});
  const [newHintForms, setNewHintForms] = useState<Record<string, AdminPromptHintRequest>>({});
  const [newPromptForm, setNewPromptForm] = useState<AdminPromptRequest>(emptyPromptForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedPromptIds, setExpandedPromptIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
      try {
        const user = await getCurrentUser();
        if (!mounted) {
          return;
        }

        setCurrentUser(user);
        if (!user?.admin) {
          setLoading(false);
          return;
        }

        const adminPrompts = await getAdminPrompts();
        if (!mounted) {
          return;
        }

        applyPromptState(adminPrompts);
        setLoading(false);
      } catch {
        if (!mounted) {
          return;
        }

        setError("관리자 화면을 불러오지 못했어요.");
        setLoading(false);
      }
    }

    void loadPage();

    return () => {
      mounted = false;
    };
  }, []);

  const activePromptCount = useMemo(
    () => prompts.filter((prompt) => prompt.active).length,
    [prompts]
  );

  function applyPromptState(adminPrompts: AdminPrompt[]) {
    setPrompts(adminPrompts);
    setPromptForms(
      Object.fromEntries(adminPrompts.map((prompt) => [prompt.id, toPromptForm(prompt)]))
    );
    setHintForms(
      Object.fromEntries(
        adminPrompts.flatMap((prompt) =>
          prompt.hints.map((hint) => [hint.id, toHintForm(hint)] as const)
        )
      )
    );
    setNewHintForms(
      Object.fromEntries(adminPrompts.map((prompt) => [prompt.id, { ...emptyHintForm }]))
    );
    setExpandedPromptIds((current) => {
      const next = { ...current };
      for (const prompt of adminPrompts) {
        if (!(prompt.id in next)) {
          next[prompt.id] = false;
        }
      }
      for (const key of Object.keys(next)) {
        if (!adminPrompts.some((prompt) => prompt.id === key)) {
          delete next[key];
        }
      }
      return next;
    });
  }

  function updatePromptForm(promptId: string, updater: (current: AdminPromptRequest) => AdminPromptRequest) {
    setPromptForms((current) => ({
      ...current,
      [promptId]: updater(current[promptId] ?? emptyPromptForm)
    }));
  }

  function updateHintForm(hintId: string, updater: (current: AdminPromptHintRequest) => AdminPromptHintRequest) {
    setHintForms((current) => ({
      ...current,
      [hintId]: updater(current[hintId] ?? emptyHintForm)
    }));
  }

  function updateNewHintForm(
    promptId: string,
    updater: (current: AdminPromptHintRequest) => AdminPromptHintRequest
  ) {
    setNewHintForms((current) => ({
      ...current,
      [promptId]: updater(current[promptId] ?? emptyHintForm)
    }));
  }

  async function refreshPrompts(successMessage?: string) {
    const adminPrompts = await getAdminPrompts();
    applyPromptState(adminPrompts);
    if (successMessage) {
      setNotice(successMessage);
    }
  }

  async function handleCreatePrompt() {
    try {
      setError("");
      setNotice("");
      await createAdminPrompt(newPromptForm);
      setNewPromptForm({ ...emptyPromptForm });
      await refreshPrompts("질문을 추가했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "질문을 추가하지 못했어요.");
    }
  }

  async function handleSavePrompt(promptId: string) {
    try {
      setError("");
      setNotice("");
      await updateAdminPrompt(promptId, promptForms[promptId]);
      await refreshPrompts("질문을 저장했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "질문을 저장하지 못했어요.");
    }
  }

  async function handleDeletePrompt(promptId: string) {
    try {
      setError("");
      setNotice("");
      await deleteAdminPrompt(promptId);
      await refreshPrompts("질문을 비활성화했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "질문을 비활성화하지 못했어요.");
    }
  }

  async function handleCreateHint(promptId: string) {
    try {
      setError("");
      setNotice("");
      await createAdminPromptHint(promptId, newHintForms[promptId] ?? emptyHintForm);
      await refreshPrompts("힌트를 추가했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "힌트를 추가하지 못했어요.");
    }
  }

  async function handleSaveHint(promptId: string, hintId: string) {
    try {
      setError("");
      setNotice("");
      await updateAdminPromptHint(promptId, hintId, hintForms[hintId]);
      await refreshPrompts("힌트를 저장했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "힌트를 저장하지 못했어요.");
    }
  }

  async function handleDeleteHint(promptId: string, hintId: string) {
    try {
      setError("");
      setNotice("");
      await deleteAdminPromptHint(promptId, hintId);
      await refreshPrompts("힌트를 비활성화했어요.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "힌트를 비활성화하지 못했어요.");
    }
  }

  function togglePrompt(promptId: string) {
    setExpandedPromptIds((current) => ({
      ...current,
      [promptId]: !current[promptId]
    }));
  }

  if (loading || currentUser === undefined) {
    return (
      <main className={authStyles.page}>
        <section className={authStyles.emptyCard}>
          <h2>관리 화면을 준비하고 있어요</h2>
          <p>잠시만 기다려 주세요.</p>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className={authStyles.page}>
        <section className={authStyles.emptyCard}>
          <h2>로그인이 필요해요</h2>
          <p>관리자 화면은 로그인 후에만 열 수 있어요.</p>
        </section>
      </main>
    );
  }

  if (!currentUser.admin) {
    return (
      <main className={authStyles.page}>
        <section className={authStyles.emptyCard}>
          <h2>관리자 권한이 필요해요</h2>
          <p>등록된 관리자 이메일로 로그인해야 질문과 힌트를 관리할 수 있어요.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={authStyles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>콘텐츠 관리</div>
        <h1>질문과 힌트를 한곳에서 관리해요</h1>
        <p>
          운영 중인 질문을 바로 수정하고, starter와 활용 단어 힌트까지 함께 다듬을 수 있어요.
          삭제는 실제 제거 대신 비활성화로 처리해서 기존 학습 기록을 안전하게 보존합니다.
        </p>
        <div className={styles.summaryCards}>
          <article className={styles.summaryCard}>
            <span>전체 질문</span>
            <strong>{prompts.length}개</strong>
          </article>
          <article className={styles.summaryCard}>
            <span>활성 질문</span>
            <strong>{activePromptCount}개</strong>
          </article>
        </div>
      </section>

      <section className={styles.createCard}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionEyebrow}>새 질문 추가</div>
            <h2>새로운 오늘의 질문 만들기</h2>
          </div>
        </div>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>주제</span>
            <input
              className={styles.input}
              value={newPromptForm.topic}
              onChange={(event) =>
                setNewPromptForm((current) => ({ ...current, topic: event.target.value }))
              }
            />
          </label>
          <label className={styles.field}>
            <span>난이도</span>
            <select
              className={styles.input}
              value={newPromptForm.difficulty}
              onChange={(event) =>
                setNewPromptForm((current) => ({
                  ...current,
                  difficulty: event.target.value as PromptDifficulty
                }))
              }
            >
              {difficultyOptions.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>정렬 순서</span>
            <input
              className={styles.input}
              type="number"
              value={newPromptForm.displayOrder}
              onChange={(event) =>
                setNewPromptForm((current) => ({
                  ...current,
                  displayOrder: Number(event.target.value)
                }))
              }
            />
          </label>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={newPromptForm.active}
              onChange={(event) =>
                setNewPromptForm((current) => ({ ...current, active: event.target.checked }))
              }
            />
            <span>바로 활성화</span>
          </label>
          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>영어 질문</span>
            <textarea
              className={styles.textarea}
              rows={3}
              value={newPromptForm.questionEn}
              onChange={(event) =>
                setNewPromptForm((current) => ({ ...current, questionEn: event.target.value }))
              }
            />
          </label>
          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>한국어 질문</span>
            <textarea
              className={styles.textarea}
              rows={3}
              value={newPromptForm.questionKo}
              onChange={(event) =>
                setNewPromptForm((current) => ({ ...current, questionKo: event.target.value }))
              }
            />
          </label>
          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>TIP</span>
            <textarea
              className={styles.textarea}
              rows={2}
              value={newPromptForm.tip}
              onChange={(event) =>
                setNewPromptForm((current) => ({ ...current, tip: event.target.value }))
              }
            />
          </label>
        </div>
        <div className={styles.actions}>
          <button type="button" className={authStyles.primaryButton} onClick={() => void handleCreatePrompt()}>
            질문 추가하기
          </button>
        </div>
      </section>

      {notice ? <p className={authStyles.notice}>{notice}</p> : null}
      {error ? <p className={authStyles.error}>{error}</p> : null}

      <section className={styles.listSection}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionEyebrow}>기존 질문</div>
            <h2>질문과 힌트 수정하기</h2>
          </div>
        </div>

        <div className={styles.promptList}>
          {prompts.map((prompt) => {
            const form = promptForms[prompt.id] ?? toPromptForm(prompt);
            const isExpanded = expandedPromptIds[prompt.id] ?? false;

            return (
              <article key={prompt.id} className={styles.promptCard}>
                <button
                  type="button"
                  className={styles.promptToggle}
                  onClick={() => togglePrompt(prompt.id)}
                >
                  <div>
                    <div className={styles.promptMeta}>
                      <span>{prompt.id}</span>
                      <span>{prompt.difficulty}</span>
                      <span>{prompt.active ? "활성" : "비활성"}</span>
                    </div>
                    <h3>{prompt.questionEn}</h3>
                    <p>{prompt.questionKo}</p>
                  </div>
                  <strong>{isExpanded ? "접기" : "열기"}</strong>
                </button>

                {isExpanded ? (
                  <div className={styles.promptEditor}>
                    <div className={styles.formGrid}>
                      <label className={styles.field}>
                        <span>주제</span>
                        <input
                          className={styles.input}
                          value={form.topic}
                          onChange={(event) =>
                            updatePromptForm(prompt.id, (current) => ({
                              ...current,
                              topic: event.target.value
                            }))
                          }
                        />
                      </label>
                      <label className={styles.field}>
                        <span>난이도</span>
                        <select
                          className={styles.input}
                          value={form.difficulty}
                          onChange={(event) =>
                            updatePromptForm(prompt.id, (current) => ({
                              ...current,
                              difficulty: event.target.value as PromptDifficulty
                            }))
                          }
                        >
                          {difficultyOptions.map((difficulty) => (
                            <option key={difficulty} value={difficulty}>
                              {difficulty}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>정렬 순서</span>
                        <input
                          className={styles.input}
                          type="number"
                          value={form.displayOrder}
                          onChange={(event) =>
                            updatePromptForm(prompt.id, (current) => ({
                              ...current,
                              displayOrder: Number(event.target.value)
                            }))
                          }
                        />
                      </label>
                      <label className={styles.checkboxField}>
                        <input
                          type="checkbox"
                          checked={form.active}
                          onChange={(event) =>
                            updatePromptForm(prompt.id, (current) => ({
                              ...current,
                              active: event.target.checked
                            }))
                          }
                        />
                        <span>활성 상태</span>
                      </label>
                      <label className={`${styles.field} ${styles.fullWidth}`}>
                        <span>영어 질문</span>
                        <textarea
                          className={styles.textarea}
                          rows={3}
                          value={form.questionEn}
                          onChange={(event) =>
                            updatePromptForm(prompt.id, (current) => ({
                              ...current,
                              questionEn: event.target.value
                            }))
                          }
                        />
                      </label>
                      <label className={`${styles.field} ${styles.fullWidth}`}>
                        <span>한국어 질문</span>
                        <textarea
                          className={styles.textarea}
                          rows={3}
                          value={form.questionKo}
                          onChange={(event) =>
                            updatePromptForm(prompt.id, (current) => ({
                              ...current,
                              questionKo: event.target.value
                            }))
                          }
                        />
                      </label>
                      <label className={`${styles.field} ${styles.fullWidth}`}>
                        <span>TIP</span>
                        <textarea
                          className={styles.textarea}
                          rows={2}
                          value={form.tip}
                          onChange={(event) =>
                            updatePromptForm(prompt.id, (current) => ({
                              ...current,
                              tip: event.target.value
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={authStyles.primaryButton}
                        onClick={() => void handleSavePrompt(prompt.id)}
                      >
                        질문 저장
                      </button>
                      <button
                        type="button"
                        className={authStyles.ghostButton}
                        onClick={() => void handleDeletePrompt(prompt.id)}
                      >
                        비활성화
                      </button>
                    </div>

                    <div className={styles.hintSection}>
                      <div className={styles.hintHeader}>
                        <h4>힌트 관리</h4>
                        <span>{prompt.hints.length}개</span>
                      </div>

                      <div className={styles.hintList}>
                        {prompt.hints.map((hint) => {
                          const hintForm = hintForms[hint.id] ?? toHintForm(hint);

                          return (
                            <div key={hint.id} className={styles.hintCard}>
                              <div className={styles.hintTopRow}>
                                <strong>{hint.id}</strong>
                                <label className={styles.checkboxField}>
                                  <input
                                    type="checkbox"
                                    checked={hintForm.active}
                                    onChange={(event) =>
                                      updateHintForm(hint.id, (current) => ({
                                        ...current,
                                        active: event.target.checked
                                      }))
                                    }
                                  />
                                  <span>활성</span>
                                </label>
                              </div>
                              <div className={styles.hintFormGrid}>
                                <label className={styles.field}>
                                  <span>타입</span>
                                  <input
                                    className={styles.input}
                                    value={hintForm.hintType}
                                    onChange={(event) =>
                                      updateHintForm(hint.id, (current) => ({
                                        ...current,
                                        hintType: event.target.value
                                      }))
                                    }
                                  />
                                </label>
                                <label className={styles.field}>
                                  <span>정렬 순서</span>
                                  <input
                                    className={styles.input}
                                    type="number"
                                    value={hintForm.displayOrder}
                                    onChange={(event) =>
                                      updateHintForm(hint.id, (current) => ({
                                        ...current,
                                        displayOrder: Number(event.target.value)
                                      }))
                                    }
                                  />
                                </label>
                                <label className={`${styles.field} ${styles.fullWidth}`}>
                                  <span>내용</span>
                                  <textarea
                                    className={styles.textarea}
                                    rows={2}
                                    value={hintForm.content}
                                    onChange={(event) =>
                                      updateHintForm(hint.id, (current) => ({
                                        ...current,
                                        content: event.target.value
                                      }))
                                    }
                                  />
                                </label>
                              </div>
                              <div className={styles.actions}>
                                <button
                                  type="button"
                                  className={authStyles.primaryButton}
                                  onClick={() => void handleSaveHint(prompt.id, hint.id)}
                                >
                                  힌트 저장
                                </button>
                                <button
                                  type="button"
                                  className={authStyles.ghostButton}
                                  onClick={() => void handleDeleteHint(prompt.id, hint.id)}
                                >
                                  비활성화
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className={styles.newHintCard}>
                        <h5>새 힌트 추가</h5>
                        <div className={styles.hintFormGrid}>
                          <label className={styles.field}>
                            <span>타입</span>
                            <input
                              className={styles.input}
                              value={newHintForms[prompt.id]?.hintType ?? emptyHintForm.hintType}
                              onChange={(event) =>
                                updateNewHintForm(prompt.id, (current) => ({
                                  ...current,
                                  hintType: event.target.value
                                }))
                              }
                            />
                          </label>
                          <label className={styles.field}>
                            <span>정렬 순서</span>
                            <input
                              className={styles.input}
                              type="number"
                              value={
                                newHintForms[prompt.id]?.displayOrder ?? emptyHintForm.displayOrder
                              }
                              onChange={(event) =>
                                updateNewHintForm(prompt.id, (current) => ({
                                  ...current,
                                  displayOrder: Number(event.target.value)
                                }))
                              }
                            />
                          </label>
                          <label className={`${styles.field} ${styles.fullWidth}`}>
                            <span>내용</span>
                            <textarea
                              className={styles.textarea}
                              rows={2}
                              value={newHintForms[prompt.id]?.content ?? emptyHintForm.content}
                              onChange={(event) =>
                                updateNewHintForm(prompt.id, (current) => ({
                                  ...current,
                                  content: event.target.value
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={authStyles.primaryButton}
                            onClick={() => void handleCreateHint(prompt.id)}
                          >
                            힌트 추가
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
