import AsyncStorage from "@react-native-async-storage/async-storage";

const HOME_TUTORIAL_COMPLETED_KEY = "writeloop.home-tutorial.v1.completed";
const HOME_TUTORIAL_REPLAY_KEY = "writeloop.home-tutorial.v1.replay";

export async function hasCompletedHomeTutorial() {
  return (await AsyncStorage.getItem(HOME_TUTORIAL_COMPLETED_KEY)) === "true";
}

export async function completeHomeTutorial() {
  await AsyncStorage.multiSet([
    [HOME_TUTORIAL_COMPLETED_KEY, "true"],
    [HOME_TUTORIAL_REPLAY_KEY, "false"]
  ]);
}

export async function requestHomeTutorialReplay() {
  await AsyncStorage.setItem(HOME_TUTORIAL_REPLAY_KEY, "true");
}

export async function consumeHomeTutorialReplay() {
  const shouldReplay = (await AsyncStorage.getItem(HOME_TUTORIAL_REPLAY_KEY)) === "true";
  if (shouldReplay) {
    await AsyncStorage.removeItem(HOME_TUTORIAL_REPLAY_KEY);
  }

  return shouldReplay;
}
