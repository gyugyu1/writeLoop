import fs from "fs";
import path from "path";

const OUTPUT_SQL = path.join("infra", "mysql", "schema", "054-seed-intro-prompts-to-300.sql");

function word(content, meaningKo, usageTipKo, exampleEn, expressionFamily) {
  return {
    itemType: "WORD",
    content,
    meaningKo,
    usageTipKo,
    exampleEn,
    expressionFamily,
  };
}

function phrase(content, meaningKo, usageTipKo, exampleEn, expressionFamily) {
  return {
    itemType: "PHRASE",
    content,
    meaningKo,
    usageTipKo,
    exampleEn,
    expressionFamily,
  };
}

function frame(content, meaningKo, usageTipKo, exampleEn, expressionFamily) {
  return {
    itemType: "FRAME",
    content,
    meaningKo,
    usageTipKo,
    exampleEn,
    expressionFamily,
  };
}

function promptSpec(id, questionEn, questionKo, starter) {
  return { id, questionEn, questionKo, starter };
}

function sql(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

const routinePacks = [
  {
    code: "morning-prep",
    detailName: "Morning Prep",
    detailOrder: 1,
    tip: "순서대로 두세 가지 행동을 짧게 말해 보세요.",
    words: [
      word("alarm", "알람", "아침 시작을 말할 때 바로 쓸 수 있어요.", "My alarm goes off early every day.", "INTRO_ROUTINE_MORNING"),
      word("curtains", "커튼", "아침에 방 분위기가 바뀌는 장면을 말하기 좋아요.", "I open the curtains as soon as I wake up.", "INTRO_ROUTINE_MORNING"),
      word("mirror", "거울", "준비하면서 자신을 확인하는 상황에 자연스러워요.", "I check the mirror before I leave.", "INTRO_ROUTINE_MORNING"),
      word("outfit", "옷차림", "아침에 무엇을 입는지 말할 때 좋아요.", "I choose a simple outfit for the day.", "INTRO_ROUTINE_MORNING"),
      word("schedule", "일정", "하루 계획을 확인하는 흐름을 말할 때 써요.", "I look at my schedule before breakfast.", "INTRO_ROUTINE_MORNING"),
      word("bag", "가방", "나가기 전 준비물을 챙기는 상황에 잘 맞아요.", "My bag is ready by the door.", "INTRO_ROUTINE_MORNING"),
      word("shoes", "신발", "집을 나서기 직전 동작을 설명할 때 좋아요.", "I put on my shoes right before I leave.", "INTRO_ROUTINE_MORNING"),
      word("message", "메시지", "아침에 짧게 확인하는 소통을 말할 때 써요.", "I check one message before I go out.", "INTRO_ROUTINE_MORNING"),
      word("breakfast", "아침 식사", "아침 루틴의 중심 활동이라 직접적으로 써요.", "Breakfast comes after I finish getting ready.", "INTRO_ROUTINE_MORNING"),
      word("quickly", "빠르게", "짧고 바쁜 아침 분위기를 말할 때 유용해요.", "I move quickly on weekday mornings.", "INTRO_ROUTINE_MORNING"),
    ],
    phrases: [
      phrase("turn off my alarm", "알람을 끄다", "아침 루틴의 가장 첫 장면으로 쓰기 좋아요.", "I turn off my alarm and sit up right away.", "INTRO_ROUTINE_MORNING"),
      phrase("wash my face", "세수하다", "준비를 시작하는 기본 동작으로 자연스러워요.", "I wash my face before I do anything else.", "INTRO_ROUTINE_MORNING"),
      phrase("get dressed", "옷을 입다", "외출 준비를 말할 때 가장 자주 써요.", "I get dressed after I check the weather.", "INTRO_ROUTINE_MORNING"),
      phrase("check my schedule", "일정을 확인하다", "오늘 할 일을 짧게 언급할 때 좋아요.", "I check my schedule while I drink water.", "INTRO_ROUTINE_MORNING"),
      phrase("leave the house", "집을 나서다", "아침 루틴의 마무리를 자연스럽게 보여 줘요.", "I leave the house once everything is ready.", "INTRO_ROUTINE_MORNING"),
    ],
    prompts: [
      promptSpec("prompt-routine-2001", "What do you usually do before breakfast?", "아침 식사 전에 보통 무엇을 하나요?", "Before breakfast, I usually ..."),
      promptSpec("prompt-routine-2002", "What do you usually do after you turn off your alarm?", "알람을 끈 뒤에 보통 무엇을 하나요?", "After I turn off my alarm, I usually ..."),
      promptSpec("prompt-routine-2003", "What do you usually do after you wash your face?", "세수한 뒤에 보통 무엇을 하나요?", "After I wash my face, I usually ..."),
      promptSpec("prompt-routine-2004", "What do you usually do before you brush your hair?", "머리를 빗기 전에 보통 무엇을 하나요?", "Before I brush my hair, I usually ..."),
      promptSpec("prompt-routine-2005", "What do you usually do after you open the curtains?", "커튼을 연 뒤에 보통 무엇을 하나요?", "After I open the curtains, I usually ..."),
      promptSpec("prompt-routine-2006", "While you make your first drink of the day, what do you usually do?", "하루 첫 음료를 준비하면서 보통 무엇을 하나요?", "While I make my first drink of the day, I usually ..."),
      promptSpec("prompt-routine-2007", "What do you usually do before you check your schedule?", "일정을 확인하기 전에 보통 무엇을 하나요?", "Before I check my schedule, I usually ..."),
      promptSpec("prompt-routine-2008", "What do you usually do after you get dressed?", "옷을 입은 뒤에 보통 무엇을 하나요?", "After I get dressed, I usually ..."),
      promptSpec("prompt-routine-2009", "What do you usually do before you put on your shoes?", "신발을 신기 전에 보통 무엇을 하나요?", "Before I put on my shoes, I usually ..."),
      promptSpec("prompt-routine-2010", "What do you usually do before you leave your room in the morning?", "아침에 방을 나서기 전에 보통 무엇을 하나요?", "Before I leave my room in the morning, I usually ..."),
      promptSpec("prompt-routine-2011", "While you pack your bag in the morning, what do you usually do?", "아침에 가방을 챙기면서 보통 무엇을 하나요?", "While I pack my bag in the morning, I usually ..."),
      promptSpec("prompt-routine-2012", "What do you usually do before you look at your messages in the morning?", "아침에 메시지를 보기 전에 보통 무엇을 하나요?", "Before I look at my messages in the morning, I usually ..."),
      promptSpec("prompt-routine-2013", "What do you usually do after you make your bed?", "침대를 정리한 뒤에 보통 무엇을 하나요?", "After I make my bed, I usually ..."),
      promptSpec("prompt-routine-2014", "What do you usually do before you leave home in the morning?", "아침에 집을 나서기 전에 보통 무엇을 하나요?", "Before I leave home in the morning, I usually ..."),
      promptSpec("prompt-routine-2015", "While you wait for the elevator in the morning, what do you usually do?", "아침에 엘리베이터를 기다리면서 보통 무엇을 하나요?", "While I wait for the elevator in the morning, I usually ..."),
    ],
  },
  {
    code: "commute-moves",
    detailName: "Commute Moves",
    detailOrder: 2,
    tip: "이동 중에 자주 하는 행동을 한두 가지 말해 보세요.",
    words: [
      word("station", "역", "이동 시작 지점을 말할 때 자연스러워요.", "The station is busy in the morning.", "INTRO_ROUTINE_COMMUTE"),
      word("platform", "승강장", "기차나 지하철을 기다리는 상황에 잘 맞아요.", "I stand on the platform for a few minutes.", "INTRO_ROUTINE_COMMUTE"),
      word("bus", "버스", "대중교통 이동을 말할 때 가장 직접적으로 써요.", "I take the bus when I do not want to walk.", "INTRO_ROUTINE_COMMUTE"),
      word("traffic", "교통", "길이 막히거나 늦어지는 상황을 말할 때 써요.", "Traffic is slow on rainy mornings.", "INTRO_ROUTINE_COMMUTE"),
      word("seat", "자리", "앉는지 서는지 말할 때 자주 써요.", "I look for a seat if the bus is full.", "INTRO_ROUTINE_COMMUTE"),
      word("gate", "개찰구", "카드를 찍고 들어가는 흐름을 말할 때 좋아요.", "I go through the gate and head downstairs.", "INTRO_ROUTINE_COMMUTE"),
      word("card", "교통카드", "대중교통을 탈 때 쓰는 준비물을 말해 줘요.", "I tap my card at the gate.", "INTRO_ROUTINE_COMMUTE"),
      word("late", "늦은, 지연된", "버스나 지하철이 늦는 상황에 직접적이에요.", "The bus is late sometimes.", "INTRO_ROUTINE_COMMUTE"),
      word("stairs", "계단", "역이나 건물에서 이동하는 장면을 더 구체적으로 만들어요.", "I take the stairs when I have time.", "INTRO_ROUTINE_COMMUTE"),
      word("walk", "걷다", "정류장과 목적지 사이 이동을 말할 때 좋아요.", "I walk from the station to my office.", "INTRO_ROUTINE_COMMUTE"),
    ],
    phrases: [
      phrase("wait at the bus stop", "버스 정류장에서 기다리다", "출발 전 루틴을 말할 때 쓰기 좋아요.", "I wait at the bus stop and check the time.", "INTRO_ROUTINE_COMMUTE"),
      phrase("get on the bus", "버스에 타다", "탑승 직후 하는 행동으로 자연스럽게 이어져요.", "I get on the bus and stand near the door.", "INTRO_ROUTINE_COMMUTE"),
      phrase("find a seat", "자리를 찾다", "앉아서 무엇을 하는지 설명하기 쉬워요.", "I find a seat and look out the window.", "INTRO_ROUTINE_COMMUTE"),
      phrase("get off the bus", "버스에서 내리다", "도착 후 다음 행동을 말할 때 좋아요.", "I get off the bus and walk to work.", "INTRO_ROUTINE_COMMUTE"),
      phrase("walk to my destination", "목적지까지 걸어가다", "마지막 이동 단계를 말할 때 쓰기 좋아요.", "I walk to my destination with my earphones on.", "INTRO_ROUTINE_COMMUTE"),
    ],
    prompts: [
      promptSpec("prompt-routine-2016", "While you wait at the bus stop, what do you usually do?", "버스 정류장에서 기다리면서 보통 무엇을 하나요?", "While I wait at the bus stop, I usually ..."),
      promptSpec("prompt-routine-2017", "What do you usually do after you get on the bus?", "버스에 탄 뒤에 보통 무엇을 하나요?", "After I get on the bus, I usually ..."),
      promptSpec("prompt-routine-2018", "When you ride the bus without a seat, what do you usually do?", "버스에서 자리에 앉지 못했을 때 보통 무엇을 하나요?", "When I ride the bus without a seat, I usually ..."),
      promptSpec("prompt-routine-2019", "What do you usually do after you find a seat on the train?", "기차에서 자리를 찾은 뒤에 보통 무엇을 하나요?", "After I find a seat on the train, I usually ..."),
      promptSpec("prompt-routine-2020", "While you wait for the subway doors to open, what do you usually do?", "지하철 문이 열리기를 기다리면서 보통 무엇을 하나요?", "While I wait for the subway doors to open, I usually ..."),
      promptSpec("prompt-routine-2021", "What do you usually do after you get off the bus?", "버스에서 내린 뒤에 보통 무엇을 하나요?", "After I get off the bus, I usually ..."),
      promptSpec("prompt-routine-2022", "While you walk from the station to your destination, what do you usually do?", "역에서 목적지까지 걸어가면서 보통 무엇을 하나요?", "While I walk from the station to my destination, I usually ..."),
      promptSpec("prompt-routine-2023", "When the bus is late, what do you usually do?", "버스가 늦을 때 보통 무엇을 하나요?", "When the bus is late, I usually ..."),
      promptSpec("prompt-routine-2024", "While you stand on the platform, what do you usually do?", "승강장에 서 있을 때 보통 무엇을 하나요?", "While I stand on the platform, I usually ..."),
      promptSpec("prompt-routine-2025", "What do you usually do after you reach the station entrance?", "역 입구에 도착한 뒤에 보통 무엇을 하나요?", "After I reach the station entrance, I usually ..."),
      promptSpec("prompt-routine-2026", "While you ride the escalator at the station, what do you usually do?", "역 에스컬레이터를 타면서 보통 무엇을 하나요?", "While I ride the escalator at the station, I usually ..."),
      promptSpec("prompt-routine-2027", "What do you usually do during a short ride?", "짧은 이동 시간에는 보통 무엇을 하나요?", "During a short ride, I usually ..."),
      promptSpec("prompt-routine-2028", "What do you usually do after you tap your card at the gate?", "개찰구에서 카드를 찍은 뒤에 보통 무엇을 하나요?", "After I tap my card at the gate, I usually ..."),
      promptSpec("prompt-routine-2029", "While you cross the street near the station, what do you usually do?", "역 근처에서 길을 건너면서 보통 무엇을 하나요?", "While I cross the street near the station, I usually ..."),
      promptSpec("prompt-routine-2030", "What do you usually do after you arrive in your neighborhood?", "집 근처에 도착한 뒤에 보통 무엇을 하나요?", "After I arrive in my neighborhood, I usually ..."),
    ],
  },
  {
    code: "short-breaks",
    detailName: "Short Breaks",
    detailOrder: 3,
    tip: "짧은 휴식 시간에 하는 행동을 구체적으로 말해 보세요.",
    words: [
      word("break", "휴식", "짧게 쉬는 시간 자체를 말할 때 써요.", "A short break helps me reset my mind.", "INTRO_ROUTINE_BREAK"),
      word("water", "물", "쉬는 시간에 가장 자주 하는 행동과 연결하기 좋아요.", "I drink water during every break.", "INTRO_ROUTINE_BREAK"),
      word("snack", "간식", "가볍게 먹는 것을 말할 때 직접적이에요.", "A small snack gives me more energy.", "INTRO_ROUTINE_BREAK"),
      word("air", "공기", "바깥에 잠깐 나가서 쉬는 상황을 말할 때 좋아요.", "Fresh air helps me feel better.", "INTRO_ROUTINE_BREAK"),
      word("stretch", "스트레칭", "짧게 몸을 푸는 동작을 말할 때 좋아요.", "A quick stretch wakes me up.", "INTRO_ROUTINE_BREAK"),
      word("eyes", "눈", "잠깐 쉬면서 눈을 쉬게 하는 흐름과 잘 맞아요.", "I close my eyes for a moment.", "INTRO_ROUTINE_BREAK"),
      word("energy", "에너지", "쉬는 이유를 짧게 설명할 때 유용해요.", "I need more energy in the afternoon.", "INTRO_ROUTINE_BREAK"),
      word("quiet", "조용한", "조용한 휴식을 좋아할 때 써요.", "I like a quiet break when I am tired.", "INTRO_ROUTINE_BREAK"),
      word("minute", "분", "짧은 시간을 말할 때 직접적으로 써요.", "I rest for just a minute or two.", "INTRO_ROUTINE_BREAK"),
      word("reset", "리셋, 다시 가다듬기", "기분이나 집중을 다시 잡는 느낌을 줄 때 좋아요.", "A small break helps me reset.", "INTRO_ROUTINE_BREAK"),
    ],
    phrases: [
      phrase("take a short break", "잠깐 쉬다", "짧은 휴식을 말할 때 가장 기본이 되는 표현이에요.", "I take a short break after one task.", "INTRO_ROUTINE_BREAK"),
      phrase("drink some water", "물을 좀 마시다", "쉬는 시간의 행동을 아주 쉽게 말할 수 있어요.", "I drink some water and look outside.", "INTRO_ROUTINE_BREAK"),
      phrase("step outside", "밖으로 잠깐 나가다", "공기를 쐬는 상황을 말할 때 자연스러워요.", "I step outside for fresh air.", "INTRO_ROUTINE_BREAK"),
      phrase("stretch for a minute", "1분 정도 스트레칭하다", "간단한 휴식 행동으로 바로 써요.", "I stretch for a minute before I sit down again.", "INTRO_ROUTINE_BREAK"),
      phrase("go back to my seat", "자리로 돌아가다", "휴식이 끝난 뒤 흐름을 말할 때 좋아요.", "I go back to my seat when I feel ready.", "INTRO_ROUTINE_BREAK"),
    ],
    prompts: [
      promptSpec("prompt-routine-2031", "When you have a five-minute break, what do you usually do?", "5분 정도 쉴 시간이 있을 때 보통 무엇을 하나요?", "When I have a five-minute break, I usually ..."),
      promptSpec("prompt-routine-2032", "What do you usually do before you buy a snack?", "간식을 사기 전에 보통 무엇을 하나요?", "Before I buy a snack, I usually ..."),
      promptSpec("prompt-routine-2033", "What do you usually do after you buy a snack?", "간식을 산 뒤에 보통 무엇을 하나요?", "After I buy a snack, I usually ..."),
      promptSpec("prompt-routine-2034", "While you drink water during a break, what do you usually do?", "쉬는 시간에 물을 마시면서 보통 무엇을 하나요?", "While I drink water during a break, I usually ..."),
      promptSpec("prompt-routine-2035", "When you step outside for fresh air, what do you usually do?", "바깥 공기를 쐬러 잠깐 나갈 때 보통 무엇을 하나요?", "When I step outside for fresh air, I usually ..."),
      promptSpec("prompt-routine-2036", "What do you usually do after you stretch for a minute?", "잠깐 스트레칭한 뒤에 보통 무엇을 하나요?", "After I stretch for a minute, I usually ..."),
      promptSpec("prompt-routine-2037", "While you rest your eyes, what do you usually do?", "눈을 쉬게 하면서 보통 무엇을 하나요?", "While I rest my eyes, I usually ..."),
      promptSpec("prompt-routine-2038", "When you need a quick reset, what do you usually do?", "기분을 빨리 다시 잡아야 할 때 보통 무엇을 하나요?", "When I need a quick reset, I usually ..."),
      promptSpec("prompt-routine-2039", "What do you usually do before you go back to your seat?", "자리로 돌아가기 전에 보통 무엇을 하나요?", "Before I go back to my seat, I usually ..."),
      promptSpec("prompt-routine-2040", "What do you usually do after a short walk outside?", "밖에서 잠깐 걸은 뒤에 보통 무엇을 하나요?", "After a short walk outside, I usually ..."),
      promptSpec("prompt-routine-2041", "While you wait for hot water to cool, what do you usually do?", "뜨거운 물이 조금 식기를 기다리면서 보통 무엇을 하나요?", "While I wait for hot water to cool, I usually ..."),
      promptSpec("prompt-routine-2042", "When you sit quietly for a moment, what do you usually do?", "잠깐 조용히 앉아 있을 때 보통 무엇을 하나요?", "When I sit quietly for a moment, I usually ..."),
      promptSpec("prompt-routine-2043", "What do you usually do after you finish one small task?", "작은 일을 하나 끝낸 뒤에 보통 무엇을 하나요?", "After I finish one small task, I usually ..."),
      promptSpec("prompt-routine-2044", "When you feel sleepy in the afternoon, what do you usually do?", "오후에 졸릴 때 보통 무엇을 하나요?", "When I feel sleepy in the afternoon, I usually ..."),
      promptSpec("prompt-routine-2045", "What do you usually do before you start your next task?", "다음 일을 시작하기 전에 보통 무엇을 하나요?", "Before I start my next task, I usually ..."),
    ],
  },
  {
    code: "lunch-snack",
    detailName: "Lunch and Snacks",
    detailOrder: 4,
    tip: "점심 전후에 자주 하는 행동을 자연스럽게 말해 보세요.",
    words: [
      word("lunch", "점심", "점심 전후 루틴을 직접적으로 말할 때 좋아요.", "Lunch is the middle point of my day.", "INTRO_ROUTINE_LUNCH"),
      word("tray", "쟁반", "식당이나 카페에서 식사를 마칠 때 쓰기 좋아요.", "I return my tray after lunch.", "INTRO_ROUTINE_LUNCH"),
      word("takeout", "포장 음식", "받아서 먹는 점심 상황을 말할 때 유용해요.", "Takeout is easy on busy days.", "INTRO_ROUTINE_LUNCH"),
      word("drink", "음료", "점심과 함께 마시는 것을 말할 때 자연스러워요.", "I usually buy a cold drink at lunch.", "INTRO_ROUTINE_LUNCH"),
      word("seat", "자리", "어디에 앉는지 말할 때 바로 쓸 수 있어요.", "I look for a quiet seat.", "INTRO_ROUTINE_LUNCH"),
      word("table", "테이블", "먹는 공간을 묘사할 때 좋습니다.", "I clean the table before I leave.", "INTRO_ROUTINE_LUNCH"),
      word("light", "가벼운", "부담 없는 간식이나 점심을 말할 때 써요.", "I like something light in the afternoon.", "INTRO_ROUTINE_LUNCH"),
      word("hungry", "배고픈", "점심 전후의 상태를 짧게 설명해 줘요.", "I get hungry around noon.", "INTRO_ROUTINE_LUNCH"),
      word("afternoon", "오후", "점심 뒤의 흐름을 말할 때 꼭 필요한 단어예요.", "My afternoon feels better after lunch.", "INTRO_ROUTINE_LUNCH"),
      word("tidy", "정리하다", "먹은 뒤 마무리 행동을 말할 때 좋아요.", "I tidy the table before I leave.", "INTRO_ROUTINE_LUNCH"),
    ],
    phrases: [
      phrase("open my lunch box", "도시락을 열다", "점심 시작 장면을 쉽게 말할 수 있어요.", "I open my lunch box and look for chopsticks.", "INTRO_ROUTINE_LUNCH"),
      phrase("eat by myself", "혼자 먹다", "점심 상황을 담백하게 말할 때 좋아요.", "I eat by myself when I need quiet time.", "INTRO_ROUTINE_LUNCH"),
      phrase("eat with a friend", "친구와 함께 먹다", "같이 먹는 장면을 자연스럽게 만들어요.", "I eat with a friend when our schedules match.", "INTRO_ROUTINE_LUNCH"),
      phrase("return my tray", "쟁반을 반납하다", "점심 뒤 마무리를 말할 때 좋아요.", "I return my tray and wash my hands.", "INTRO_ROUTINE_LUNCH"),
      phrase("go back inside", "안으로 다시 들어가다", "점심 후 다음 흐름으로 넘어갈 때 자연스러워요.", "I go back inside after a short walk.", "INTRO_ROUTINE_LUNCH"),
    ],
    prompts: [
      promptSpec("prompt-routine-2046", "What do you usually do before you open your lunch box?", "도시락을 열기 전에 보통 무엇을 하나요?", "Before I open my lunch box, I usually ..."),
      promptSpec("prompt-routine-2047", "When you eat lunch by yourself, what do you usually do?", "혼자 점심을 먹을 때 보통 무엇을 하나요?", "When I eat lunch by myself, I usually ..."),
      promptSpec("prompt-routine-2048", "When you eat lunch with one friend, what do you usually do?", "친구 한 명과 점심을 먹을 때 보통 무엇을 하나요?", "When I eat lunch with one friend, I usually ..."),
      promptSpec("prompt-routine-2049", "What do you usually do after you finish your drink at lunch?", "점심에 음료를 다 마신 뒤에 보통 무엇을 하나요?", "After I finish my drink at lunch, I usually ..."),
      promptSpec("prompt-routine-2050", "While you wait for takeout, what do you usually do?", "포장 음식을 기다리면서 보통 무엇을 하나요?", "While I wait for takeout, I usually ..."),
      promptSpec("prompt-routine-2051", "What do you usually do before you choose a seat for lunch?", "점심 먹을 자리를 고르기 전에 보통 무엇을 하나요?", "Before I choose a seat for lunch, I usually ..."),
      promptSpec("prompt-routine-2052", "What do you usually do after you return your tray?", "쟁반을 반납한 뒤에 보통 무엇을 하나요?", "After I return my tray, I usually ..."),
      promptSpec("prompt-routine-2053", "When you have a little time after lunch, what do you usually do?", "점심 뒤에 시간이 조금 남을 때 보통 무엇을 하나요?", "When I have a little time after lunch, I usually ..."),
      promptSpec("prompt-routine-2054", "What do you usually do before you wash your lunch box?", "도시락통을 씻기 전에 보통 무엇을 하나요?", "Before I wash my lunch box, I usually ..."),
      promptSpec("prompt-routine-2055", "What do you usually do after you buy a drink in the afternoon?", "오후에 마실 음료를 산 뒤에 보통 무엇을 하나요?", "After I buy a drink in the afternoon, I usually ..."),
      promptSpec("prompt-routine-2056", "When you eat a small snack after lunch, what do you usually do?", "점심 뒤에 작은 간식을 먹을 때 보통 무엇을 하나요?", "When I eat a small snack after lunch, I usually ..."),
      promptSpec("prompt-routine-2057", "While you look for a quiet place to eat, what do you usually do?", "조용한 식사 자리를 찾으면서 보통 무엇을 하나요?", "While I look for a quiet place to eat, I usually ..."),
      promptSpec("prompt-routine-2058", "What do you usually do before you go back inside after lunch?", "점심 뒤에 다시 안으로 들어가기 전에 보통 무엇을 하나요?", "Before I go back inside after lunch, I usually ..."),
      promptSpec("prompt-routine-2059", "What do you usually do after you clean up your lunch space?", "점심 먹은 자리를 정리한 뒤에 보통 무엇을 하나요?", "After I clean up my lunch space, I usually ..."),
      promptSpec("prompt-routine-2060", "When you want a light snack in the afternoon, what do you usually do?", "오후에 가볍게 간식이 생각날 때 보통 무엇을 하나요?", "When I want a light snack in the afternoon, I usually ..."),
    ],
  },
  {
    code: "coming-home",
    detailName: "Coming Home",
    detailOrder: 5,
    tip: "집에 돌아온 뒤 이어지는 행동을 차례대로 말해 보세요.",
    words: [
      word("neighborhood", "동네", "집 근처에 도착한 뒤의 분위기를 말할 때 좋아요.", "My neighborhood feels quiet in the evening.", "INTRO_ROUTINE_HOME"),
      word("door", "문", "집에 들어가는 장면을 말할 때 아주 직접적이에요.", "I open the door and take a deep breath.", "INTRO_ROUTINE_HOME"),
      word("bag", "가방", "집에 오자마자 내려놓는 물건이라 자주 써요.", "I put my bag down near the sofa.", "INTRO_ROUTINE_HOME"),
      word("shoes", "신발", "집에 들어온 뒤 마무리 행동을 말할 때 좋아요.", "My shoes come off right away.", "INTRO_ROUTINE_HOME"),
      word("lights", "불", "집 안 분위기를 바꾸는 첫 행동으로 자연스러워요.", "I turn on the lights when I get home.", "INTRO_ROUTINE_HOME"),
      word("sink", "세면대", "손을 씻거나 얼굴을 씻는 상황을 말할 때 유용해요.", "I go to the sink before I rest.", "INTRO_ROUTINE_HOME"),
      word("clothes", "옷", "집에서 편한 옷으로 갈아입는 흐름을 보여 줘요.", "I change into home clothes after work.", "INTRO_ROUTINE_HOME"),
      word("quiet", "조용함", "집에 와서 쉬는 이유를 짧게 설명해 줘요.", "A little quiet helps me calm down.", "INTRO_ROUTINE_HOME"),
      word("rest", "휴식", "집에 온 뒤 가장 큰 목적을 말할 때 좋습니다.", "Rest is what I need most after a long day.", "INTRO_ROUTINE_HOME"),
      word("finally", "드디어", "하루가 끝났다는 느낌을 줄 때 좋아요.", "I finally sit down after everything is done.", "INTRO_ROUTINE_HOME"),
    ],
    phrases: [
      phrase("head home", "집으로 향하다", "귀가 흐름을 자연스럽게 시작할 때 좋아요.", "I head home as soon as my work is done.", "INTRO_ROUTINE_HOME"),
      phrase("put my bag down", "가방을 내려놓다", "집에 도착한 뒤 첫 행동으로 자주 써요.", "I put my bag down and take off my watch.", "INTRO_ROUTINE_HOME"),
      phrase("change into home clothes", "집에서 입는 옷으로 갈아입다", "집에 온 뒤 편해지는 흐름을 보여 줘요.", "I change into home clothes right away.", "INTRO_ROUTINE_HOME"),
      phrase("take off my shoes", "신발을 벗다", "귀가 직후 행동으로 아주 자연스러워요.", "I take off my shoes at the door.", "INTRO_ROUTINE_HOME"),
      phrase("sit down and rest", "앉아서 쉬다", "귀가 후 마무리를 간단히 말하기 좋아요.", "I sit down and rest for a few minutes.", "INTRO_ROUTINE_HOME"),
    ],
    prompts: [
      promptSpec("prompt-routine-2061", "What do you usually do before you head home?", "집으로 가기 전에 보통 무엇을 하나요?", "Before I head home, I usually ..."),
      promptSpec("prompt-routine-2062", "What do you usually do after you step out of the building?", "건물 밖으로 나온 뒤에 보통 무엇을 하나요?", "After I step out of the building, I usually ..."),
      promptSpec("prompt-routine-2063", "When you are tired on the way home, what do you usually do?", "집에 가는 길에 피곤할 때 보통 무엇을 하나요?", "When I am tired on the way home, I usually ..."),
      promptSpec("prompt-routine-2064", "What do you usually do after you get home?", "집에 도착한 뒤에 보통 무엇을 하나요?", "After I get home, I usually ..."),
      promptSpec("prompt-routine-2065", "What do you usually do before you enter your house?", "집에 들어가기 전에 보통 무엇을 하나요?", "Before I enter my house, I usually ..."),
      promptSpec("prompt-routine-2066", "What do you usually do after you put your bag down?", "가방을 내려놓은 뒤에 보통 무엇을 하나요?", "After I put my bag down, I usually ..."),
      promptSpec("prompt-routine-2067", "When you change into home clothes, what do you usually do next?", "집에서 입는 옷으로 갈아입은 뒤에 보통 무엇을 하나요?", "When I change into home clothes, I usually ..."),
      promptSpec("prompt-routine-2068", "What do you usually do before you sit down to rest?", "앉아서 쉬기 전에 보통 무엇을 하나요?", "Before I sit down to rest, I usually ..."),
      promptSpec("prompt-routine-2069", "What do you usually do after you take off your shoes?", "신발을 벗은 뒤에 보통 무엇을 하나요?", "After I take off my shoes, I usually ..."),
      promptSpec("prompt-routine-2070", "When you want to forget a busy day, what do you usually do?", "바쁜 하루를 잊고 싶을 때 보통 무엇을 하나요?", "When I want to forget a busy day, I usually ..."),
      promptSpec("prompt-routine-2071", "What do you usually do before you turn on the lights at home?", "집에서 불을 켜기 전에 보통 무엇을 하나요?", "Before I turn on the lights at home, I usually ..."),
      promptSpec("prompt-routine-2072", "What do you usually do after you wash your hands at home?", "집에서 손을 씻은 뒤에 보통 무엇을 하나요?", "After I wash my hands at home, I usually ..."),
      promptSpec("prompt-routine-2073", "When you need a quiet minute after work or class, what do you usually do?", "수업이나 일을 마친 뒤 조용한 시간이 필요할 때 보통 무엇을 하나요?", "When I need a quiet minute after work or class, I usually ..."),
      promptSpec("prompt-routine-2074", "What do you usually do before you start a task at home?", "집에서 일을 시작하기 전에 보통 무엇을 하나요?", "Before I start a task at home, I usually ..."),
      promptSpec("prompt-routine-2075", "What do you usually do after you finally sit down?", "드디어 자리에 앉은 뒤에 보통 무엇을 하나요?", "After I finally sit down, I usually ..."),
    ],
  },
  {
    code: "chores-kitchen",
    detailName: "Chores and Kitchen",
    detailOrder: 6,
    tip: "집안일이나 부엌일을 할 때 하는 행동을 편하게 말해 보세요.",
    words: [
      word("laundry", "빨래", "집안일을 말할 때 가장 기본이 되는 단어예요.", "I do the laundry once or twice a week.", "INTRO_ROUTINE_CHORE"),
      word("dishes", "설거지할 그릇", "부엌 정리를 말할 때 직접적으로 써요.", "The dishes are still in the sink.", "INTRO_ROUTINE_CHORE"),
      word("sink", "싱크대", "씻거나 정리하는 장소를 말할 때 좋아요.", "I stand at the sink for a few minutes.", "INTRO_ROUTINE_CHORE"),
      word("fridge", "냉장고", "음식을 넣거나 꺼내는 상황에 자연스러워요.", "I put the fruit in the fridge.", "INTRO_ROUTINE_CHORE"),
      word("trash", "쓰레기", "버리거나 정리하는 흐름을 말할 때 써요.", "I take the trash out in the evening.", "INTRO_ROUTINE_CHORE"),
      word("table", "테이블", "닦거나 차리는 행동과 연결하기 쉬워요.", "I wipe the table before dinner.", "INTRO_ROUTINE_CHORE"),
      word("plants", "식물", "물을 주는 집안일을 말할 때 좋습니다.", "My plants need water every few days.", "INTRO_ROUTINE_CHORE"),
      word("vegetables", "채소", "간단한 요리 준비를 말할 때 유용해요.", "I cut vegetables for a quick meal.", "INTRO_ROUTINE_CHORE"),
      word("meal", "식사", "간단한 한 끼를 준비하는 상황에 잘 맞아요.", "A quick meal saves me time.", "INTRO_ROUTINE_CHORE"),
      word("boil", "끓다, 끓이다", "부엌에서 물을 끓이는 장면을 말할 때 써요.", "The water starts to boil after a few minutes.", "INTRO_ROUTINE_CHORE"),
    ],
    phrases: [
      phrase("start the laundry", "세탁을 시작하다", "집안일의 시작을 말할 때 자연스러워요.", "I start the laundry before dinner.", "INTRO_ROUTINE_CHORE"),
      phrase("wash the dishes", "설거지하다", "부엌일을 설명할 때 가장 자주 쓰는 표현이에요.", "I wash the dishes right after I eat.", "INTRO_ROUTINE_CHORE"),
      phrase("water the plants", "식물에 물을 주다", "가벼운 집안일을 말할 때 좋습니다.", "I water the plants on quiet evenings.", "INTRO_ROUTINE_CHORE"),
      phrase("cut vegetables", "채소를 썰다", "간단한 요리를 준비하는 상황에 좋아요.", "I cut vegetables before I cook noodles.", "INTRO_ROUTINE_CHORE"),
      phrase("set the table", "상을 차리다", "식사 전 준비를 자연스럽게 보여 줘요.", "I set the table when dinner is almost ready.", "INTRO_ROUTINE_CHORE"),
    ],
    prompts: [
      promptSpec("prompt-routine-2076", "What do you usually do before you start the laundry?", "빨래를 시작하기 전에 보통 무엇을 하나요?", "Before I start the laundry, I usually ..."),
      promptSpec("prompt-routine-2077", "What do you usually do after you hang up wet clothes?", "젖은 옷을 넌 뒤에 보통 무엇을 하나요?", "After I hang up wet clothes, I usually ..."),
      promptSpec("prompt-routine-2078", "When you wipe the table, what do you usually do?", "테이블을 닦을 때 보통 무엇을 하나요?", "When I wipe the table, I usually ..."),
      promptSpec("prompt-routine-2079", "What do you usually do before you wash the dishes?", "설거지하기 전에 보통 무엇을 하나요?", "Before I wash the dishes, I usually ..."),
      promptSpec("prompt-routine-2080", "What do you usually do after you put the dishes away?", "그릇을 정리해 넣은 뒤에 보통 무엇을 하나요?", "After I put the dishes away, I usually ..."),
      promptSpec("prompt-routine-2081", "When you tidy your desk, what do you usually do?", "책상을 정리할 때 보통 무엇을 하나요?", "When I tidy my desk, I usually ..."),
      promptSpec("prompt-routine-2082", "What do you usually do before you water your plants?", "식물에 물을 주기 전에 보통 무엇을 하나요?", "Before I water my plants, I usually ..."),
      promptSpec("prompt-routine-2083", "What do you usually do after you take out the trash?", "쓰레기를 버린 뒤에 보통 무엇을 하나요?", "After I take out the trash, I usually ..."),
      promptSpec("prompt-routine-2084", "When you put groceries in the fridge, what do you usually do?", "장 본 것을 냉장고에 넣을 때 보통 무엇을 하나요?", "When I put groceries in the fridge, I usually ..."),
      promptSpec("prompt-routine-2085", "What do you usually do before you cut vegetables?", "채소를 썰기 전에 보통 무엇을 하나요?", "Before I cut vegetables, I usually ..."),
      promptSpec("prompt-routine-2086", "While you wait for water to boil, what do you usually do?", "물이 끓기를 기다리면서 보통 무엇을 하나요?", "While I wait for water to boil, I usually ..."),
      promptSpec("prompt-routine-2087", "What do you usually do after you make a simple snack?", "간단한 간식을 만든 뒤에 보통 무엇을 하나요?", "After I make a simple snack, I usually ..."),
      promptSpec("prompt-routine-2088", "When you need a quick meal at home, what do you usually do?", "집에서 빨리 한 끼 해결해야 할 때 보통 무엇을 하나요?", "When I need a quick meal at home, I usually ..."),
      promptSpec("prompt-routine-2089", "What do you usually do before you set the table?", "상을 차리기 전에 보통 무엇을 하나요?", "Before I set the table, I usually ..."),
      promptSpec("prompt-routine-2090", "What do you usually do after you finish in the kitchen?", "부엌일을 마친 뒤에 보통 무엇을 하나요?", "After I finish in the kitchen, I usually ..."),
    ],
  },
  {
    code: "evening-rest",
    detailName: "Evening Rest",
    detailOrder: 7,
    tip: "저녁에 쉬면서 하는 행동을 편안한 흐름으로 말해 보세요.",
    words: [
      word("lamp", "스탠드 조명", "저녁 분위기를 만들 때 쓰기 좋아요.", "A warm lamp makes the room feel calm.", "INTRO_ROUTINE_EVENING"),
      word("sofa", "소파", "저녁에 쉬는 장소를 말할 때 자연스러워요.", "I sit on the sofa after dinner.", "INTRO_ROUTINE_EVENING"),
      word("blanket", "담요", "편안한 저녁을 묘사할 때 좋아요.", "A blanket makes me feel relaxed.", "INTRO_ROUTINE_EVENING"),
      word("laptop", "노트북", "저녁에 마무리하는 디지털 기기를 말할 때 써요.", "I close my laptop before I rest.", "INTRO_ROUTINE_EVENING"),
      word("alarm", "알람", "밤에 준비하는 마지막 행동과 잘 맞아요.", "I set my alarm before I sleep.", "INTRO_ROUTINE_EVENING"),
      word("drink", "음료", "따뜻한 물이나 차 아닌 음료도 넓게 표현할 수 있어요.", "A warm drink helps me slow down.", "INTRO_ROUTINE_EVENING"),
      word("quiet", "조용한", "저녁에 원하는 분위기를 짧게 말해 줘요.", "I like a quiet evening after a busy day.", "INTRO_ROUTINE_EVENING"),
      word("music", "음악", "편하게 쉬는 장면을 만들 때 쓰기 좋아요.", "Soft music helps me relax at night.", "INTRO_ROUTINE_EVENING"),
      word("screen", "화면", "디지털 기기 사용을 줄이는 흐름과 연결하기 쉬워요.", "I try to look at screens less at night.", "INTRO_ROUTINE_EVENING"),
      word("late", "늦은", "밤이 깊어지는 상황을 말할 때 자연스러워요.", "I do not like staying up too late.", "INTRO_ROUTINE_EVENING"),
    ],
    phrases: [
      phrase("sit on the sofa", "소파에 앉다", "저녁 휴식을 말할 때 가장 쉬운 표현이에요.", "I sit on the sofa and take a deep breath.", "INTRO_ROUTINE_EVENING"),
      phrase("play soft music", "잔잔한 음악을 틀다", "편안한 분위기를 만들 때 좋아요.", "I play soft music when I want to relax.", "INTRO_ROUTINE_EVENING"),
      phrase("close my laptop", "노트북을 닫다", "하루를 마무리하는 느낌을 줄 때 좋아요.", "I close my laptop before I rest.", "INTRO_ROUTINE_EVENING"),
      phrase("set my alarm", "알람을 맞추다", "밤의 마지막 준비를 말할 때 아주 자연스러워요.", "I set my alarm and charge my phone.", "INTRO_ROUTINE_EVENING"),
      phrase("make a warm drink", "따뜻한 음료를 만들다", "조용한 저녁 시간을 설명할 때 쓰기 좋아요.", "I make a warm drink and read a little.", "INTRO_ROUTINE_EVENING"),
    ],
    prompts: [
      promptSpec("prompt-routine-2091", "When you sit on the sofa in the evening, what do you usually do?", "저녁에 소파에 앉으면 보통 무엇을 하나요?", "When I sit on the sofa in the evening, I usually ..."),
      promptSpec("prompt-routine-2092", "What do you usually do after you turn on a lamp?", "조명을 켠 뒤에 보통 무엇을 하나요?", "After I turn on a lamp, I usually ..."),
      promptSpec("prompt-routine-2093", "What do you usually do before you play music at home?", "집에서 음악을 틀기 전에 보통 무엇을 하나요?", "Before I play music at home, I usually ..."),
      promptSpec("prompt-routine-2094", "When you want to relax quietly, what do you usually do?", "조용히 쉬고 싶을 때 보통 무엇을 하나요?", "When I want to relax quietly, I usually ..."),
      promptSpec("prompt-routine-2095", "What do you usually do after you finish scrolling on your phone?", "휴대폰을 넘겨보는 것을 마친 뒤에 보통 무엇을 하나요?", "After I finish scrolling on my phone, I usually ..."),
      promptSpec("prompt-routine-2096", "What do you usually do before you watch a short video?", "짧은 영상을 보기 전에 보통 무엇을 하나요?", "Before I watch a short video, I usually ..."),
      promptSpec("prompt-routine-2097", "When you read for a few minutes at night, what do you usually do?", "밤에 몇 분 정도 읽을 때 보통 무엇을 하나요?", "When I read for a few minutes at night, I usually ..."),
      promptSpec("prompt-routine-2098", "What do you usually do after you close your laptop?", "노트북을 닫은 뒤에 보통 무엇을 하나요?", "After I close my laptop, I usually ..."),
      promptSpec("prompt-routine-2099", "What do you usually do before you set your alarm?", "알람을 맞추기 전에 보통 무엇을 하나요?", "Before I set my alarm, I usually ..."),
      promptSpec("prompt-routine-2100", "When you want a calm evening, what do you usually do?", "차분한 저녁을 보내고 싶을 때 보통 무엇을 하나요?", "When I want a calm evening, I usually ..."),
      promptSpec("prompt-routine-2101", "What do you usually do after you make a warm drink at night?", "밤에 따뜻한 음료를 만든 뒤에 보통 무엇을 하나요?", "After I make a warm drink at night, I usually ..."),
      promptSpec("prompt-routine-2102", "What do you usually do before you lie down for a short rest?", "잠깐 눕기 전에 보통 무엇을 하나요?", "Before I lie down for a short rest, I usually ..."),
      promptSpec("prompt-routine-2103", "When the house feels quiet, what do you usually do?", "집이 조용하게 느껴질 때 보통 무엇을 하나요?", "When the house feels quiet, I usually ..."),
      promptSpec("prompt-routine-2104", "What do you usually do after you turn off the TV at night?", "밤에 TV를 끈 뒤에 보통 무엇을 하나요?", "After I turn off the TV at night, I usually ..."),
      promptSpec("prompt-routine-2105", "What do you usually do before you turn off the main light at night?", "밤에 방의 큰 불을 끄기 전에 보통 무엇을 하나요?", "Before I turn off the main light at night, I usually ..."),
    ],
  },
  {
    code: "weekend-home",
    detailName: "Weekend at Home",
    detailOrder: 8,
    tip: "주말 집에서 보내는 시간을 가볍게 설명해 보세요.",
    words: [
      word("weekend", "주말", "질문의 핵심 시간을 직접적으로 말해 줘요.", "The weekend feels slower than weekdays.", "INTRO_ROUTINE_WEEKEND"),
      word("pajamas", "잠옷", "집에서 편하게 있는 장면을 말할 때 좋아요.", "I stay in my pajamas for a while.", "INTRO_ROUTINE_WEEKEND"),
      word("brunch", "브런치", "주말 늦은 아침 식사를 말할 때 유용해요.", "Brunch feels special on weekends.", "INTRO_ROUTINE_WEEKEND"),
      word("family", "가족", "주말에 같이 시간을 보내는 대상을 말할 때 써요.", "I see my family on many weekends.", "INTRO_ROUTINE_WEEKEND"),
      word("plan", "계획", "주말 일정이 있는지 말할 때 좋아요.", "I like weekends with a simple plan.", "INTRO_ROUTINE_WEEKEND"),
      word("free", "한가한, 자유로운", "주말의 여유를 말할 때 직접적이에요.", "A free weekend makes me feel lighter.", "INTRO_ROUTINE_WEEKEND"),
      word("slow", "느긋한", "주말의 느린 리듬을 설명할 때 좋아요.", "I enjoy a slow start on weekends.", "INTRO_ROUTINE_WEEKEND"),
      word("clean", "청소하다", "작은 집안일을 말할 때 쉽게 써요.", "I clean one small area on Sunday.", "INTRO_ROUTINE_WEEKEND"),
      word("call", "전화하다", "주말에 누군가와 연락하는 흐름을 보여 줘요.", "I call my family on quiet weekends.", "INTRO_ROUTINE_WEEKEND"),
      word("rest", "쉬다", "주말 집 루틴의 목적을 말할 때 좋습니다.", "Rest is important to me on weekends.", "INTRO_ROUTINE_WEEKEND"),
    ],
    phrases: [
      phrase("wake up late", "늦게 일어나다", "주말의 가장 쉬운 루틴 표현이에요.", "I wake up late when I do not have plans.", "INTRO_ROUTINE_WEEKEND"),
      phrase("stay in my pajamas", "잠옷을 입은 채로 있다", "주말 집 분위기를 자연스럽게 보여 줘요.", "I stay in my pajamas while I make brunch.", "INTRO_ROUTINE_WEEKEND"),
      phrase("make a simple brunch", "간단한 브런치를 만들다", "주말 집 루틴을 말할 때 좋아요.", "I make a simple brunch on slow Saturdays.", "INTRO_ROUTINE_WEEKEND"),
      phrase("do one small chore", "작은 집안일 하나를 하다", "주말 집안일을 부담 없이 말할 수 있어요.", "I do one small chore before I relax.", "INTRO_ROUTINE_WEEKEND"),
      phrase("call my family", "가족에게 전화하다", "주말 연락 루틴을 말할 때 자연스러워요.", "I call my family on Sunday morning.", "INTRO_ROUTINE_WEEKEND"),
    ],
    prompts: [
      promptSpec("prompt-routine-2106", "On Sunday morning at home, what do you usually do?", "일요일 아침에 집에서 보통 무엇을 하나요?", "On Sunday morning at home, I usually ..."),
      promptSpec("prompt-routine-2107", "On a slow Saturday afternoon, what do you usually do?", "느긋한 토요일 오후에 보통 무엇을 하나요?", "On a slow Saturday afternoon, I usually ..."),
      promptSpec("prompt-routine-2108", "When you have no plans on the weekend, what do you usually do?", "주말에 별다른 계획이 없을 때 보통 무엇을 하나요?", "When I have no plans on the weekend, I usually ..."),
      promptSpec("prompt-routine-2109", "What do you usually do after you wake up late on the weekend?", "주말에 늦게 일어난 뒤에 보통 무엇을 하나요?", "After I wake up late on the weekend, I usually ..."),
      promptSpec("prompt-routine-2110", "What do you usually do before you go out on Saturday?", "토요일에 외출하기 전에 보통 무엇을 하나요?", "Before I go out on Saturday, I usually ..."),
      promptSpec("prompt-routine-2111", "When you stay in your pajamas on the weekend, what do you usually do?", "주말에 잠옷을 입은 채로 있을 때 보통 무엇을 하나요?", "When I stay in my pajamas on the weekend, I usually ..."),
      promptSpec("prompt-routine-2112", "What do you usually do after you do one small chore on the weekend?", "주말에 작은 집안일 하나를 한 뒤에 보통 무엇을 하나요?", "After I do one small chore on the weekend, I usually ..."),
      promptSpec("prompt-routine-2113", "What do you usually do before you meet family on the weekend?", "주말에 가족을 만나기 전에 보통 무엇을 하나요?", "Before I meet family on the weekend, I usually ..."),
      promptSpec("prompt-routine-2114", "When you want a quiet weekend evening, what do you usually do?", "조용한 주말 저녁을 보내고 싶을 때 보통 무엇을 하나요?", "When I want a quiet weekend evening, I usually ..."),
      promptSpec("prompt-routine-2115", "What do you usually do after you finish cleaning up the kitchen on the weekend?", "주말에 부엌 정리를 마친 뒤에 보통 무엇을 하나요?", "After I finish cleaning up the kitchen on the weekend, I usually ..."),
      promptSpec("prompt-routine-2116", "What do you usually do before you start a fun activity at home on the weekend?", "주말에 집에서 재미있는 활동을 시작하기 전에 보통 무엇을 하나요?", "Before I start a fun activity at home on the weekend, I usually ..."),
      promptSpec("prompt-routine-2117", "When you spend the weekend by yourself, what do you usually do?", "주말을 혼자 보낼 때 보통 무엇을 하나요?", "When I spend the weekend by myself, I usually ..."),
      promptSpec("prompt-routine-2118", "What do you usually do after you clean up a little on Sunday?", "일요일에 조금 정리한 뒤에 보통 무엇을 하나요?", "After I clean up a little on Sunday, I usually ..."),
      promptSpec("prompt-routine-2119", "What do you usually do before you call someone on the weekend?", "주말에 누군가에게 전화하기 전에 보통 무엇을 하나요?", "Before I call someone on the weekend, I usually ..."),
      promptSpec("prompt-routine-2120", "When the weekend feels extra free, what do you usually do?", "주말이 유난히 한가하게 느껴질 때 보통 무엇을 하나요?", "When the weekend feels extra free, I usually ..."),
    ],
  },
  {
    code: "phone-study",
    detailName: "Phone and Study Micro Habits",
    detailOrder: 9,
    tip: "휴대폰이나 짧은 공부 루틴에서 하는 행동을 구체적으로 말해 보세요.",
    words: [
      word("battery", "배터리", "휴대폰 상태를 말할 때 가장 직접적이에요.", "My battery gets low in the evening.", "INTRO_ROUTINE_PHONE"),
      word("calendar", "달력 앱", "일정을 확인하는 행동과 잘 맞아요.", "I keep everything in my calendar.", "INTRO_ROUTINE_PHONE"),
      word("reminder", "리마인더", "잊지 않기 위해 하는 행동을 말할 때 좋아요.", "A reminder helps me stay on time.", "INTRO_ROUTINE_PHONE"),
      word("photo", "사진", "찍은 뒤 무엇을 하는지 말할 때 써요.", "I take a photo when I see something nice.", "INTRO_ROUTINE_PHONE"),
      word("dictionary", "사전", "공부 루틴과 연결할 때 유용해요.", "The dictionary helps me check new words.", "INTRO_ROUTINE_PHONE"),
      word("notebook", "노트", "짧은 공부 기록을 말할 때 자연스러워요.", "I write new words in a notebook.", "INTRO_ROUTINE_PHONE"),
      word("message", "메시지", "휴대폰을 보는 작은 습관을 설명할 때 좋아요.", "I read one message and move on.", "INTRO_ROUTINE_PHONE"),
      word("plan", "계획", "짧은 공부 계획을 말할 때 잘 맞아요.", "A small plan helps me start quickly.", "INTRO_ROUTINE_PHONE"),
      word("map", "지도", "길을 찾거나 시간을 확인하는 상황에 좋아요.", "I check the map before I go out.", "INTRO_ROUTINE_PHONE"),
      word("practice", "연습", "영어 공부나 짧은 학습 루틴을 말할 때 쓰기 좋아요.", "Short practice is better than nothing.", "INTRO_ROUTINE_PHONE"),
    ],
    phrases: [
      phrase("charge my phone", "휴대폰을 충전하다", "밤에 자주 하는 휴대폰 루틴이에요.", "I charge my phone before I sleep.", "INTRO_ROUTINE_PHONE"),
      phrase("set a reminder", "리마인더를 설정하다", "잊지 않으려는 행동을 말할 때 좋아요.", "I set a reminder for small tasks.", "INTRO_ROUTINE_PHONE"),
      phrase("check the map app", "지도 앱을 확인하다", "이동 전 루틴을 쉽게 말할 수 있어요.", "I check the map app before I leave.", "INTRO_ROUTINE_PHONE"),
      phrase("write new words", "새 단어를 적다", "짧은 공부 루틴을 말할 때 자연스러워요.", "I write new words after I read.", "INTRO_ROUTINE_PHONE"),
      phrase("review my notes", "노트를 다시 보다", "공부 마무리나 복습 흐름에 잘 맞아요.", "I review my notes for a few minutes.", "INTRO_ROUTINE_PHONE"),
    ],
    prompts: [
      promptSpec("prompt-routine-2121", "What do you usually do before you charge your phone?", "휴대폰을 충전하기 전에 보통 무엇을 하나요?", "Before I charge my phone, I usually ..."),
      promptSpec("prompt-routine-2122", "What do you usually do after you read a new message?", "새 메시지를 읽은 뒤에 보통 무엇을 하나요?", "After I read a new message, I usually ..."),
      promptSpec("prompt-routine-2123", "When you open your calendar app, what do you usually do?", "달력 앱을 열면 보통 무엇을 하나요?", "When I open my calendar app, I usually ..."),
      promptSpec("prompt-routine-2124", "What do you usually do before you set a reminder?", "리마인더를 설정하기 전에 보통 무엇을 하나요?", "Before I set a reminder, I usually ..."),
      promptSpec("prompt-routine-2125", "What do you usually do after you finish one online order?", "온라인 주문 하나를 마친 뒤에 보통 무엇을 하나요?", "After I finish one online order, I usually ..."),
      promptSpec("prompt-routine-2126", "When you check the map app, what do you usually do?", "지도 앱을 확인할 때 보통 무엇을 하나요?", "When I check the map app, I usually ..."),
      promptSpec("prompt-routine-2127", "What do you usually do before you join a video call?", "화상 통화에 들어가기 전에 보통 무엇을 하나요?", "Before I join a video call, I usually ..."),
      promptSpec("prompt-routine-2128", "What do you usually do after you take a photo?", "사진을 찍은 뒤에 보통 무엇을 하나요?", "After I take a photo, I usually ..."),
      promptSpec("prompt-routine-2129", "When your battery is low, what do you usually do?", "배터리가 부족할 때 보통 무엇을 하나요?", "When my battery is low, I usually ..."),
      promptSpec("prompt-routine-2130", "What do you usually do before you start English practice at home?", "집에서 영어 연습을 시작하기 전에 보통 무엇을 하나요?", "Before I start English practice at home, I usually ..."),
      promptSpec("prompt-routine-2131", "What do you usually do after you write new words in a notebook?", "노트에 새 단어를 적은 뒤에 보통 무엇을 하나요?", "After I write new words in a notebook, I usually ..."),
      promptSpec("prompt-routine-2132", "When you review simple notes, what do you usually do?", "간단한 노트를 다시 볼 때 보통 무엇을 하나요?", "When I review simple notes, I usually ..."),
      promptSpec("prompt-routine-2133", "What do you usually do before you open an online dictionary?", "온라인 사전을 열기 전에 보통 무엇을 하나요?", "Before I open an online dictionary, I usually ..."),
      promptSpec("prompt-routine-2134", "What do you usually do after you make a small study plan?", "작은 공부 계획을 세운 뒤에 보통 무엇을 하나요?", "After I make a small study plan, I usually ..."),
      promptSpec("prompt-routine-2135", "When you want to remember new words, what do you usually do?", "새 단어를 기억하고 싶을 때 보통 무엇을 하나요?", "When I want to remember new words, I usually ..."),
    ],
  },
];

const preferencePacks = [
  {
    code: "breakfast-meals",
    detailName: "Breakfast and Simple Meals",
    detailOrder: 1,
    tip: "좋아하는 음식과 그 이유를 한두 문장으로 말해 보세요.",
    words: [
      word("quick", "빠른, 금방 준비되는", "간단한 식사를 좋아할 때 자연스러워요.", "A quick meal is perfect on busy mornings.", "INTRO_PREF_MEAL"),
      word("warm", "따뜻한", "음식의 느낌을 말할 때 좋아요.", "Warm food feels better in the morning.", "INTRO_PREF_MEAL"),
      word("filling", "든든한", "배가 오래 부른 느낌을 말할 때 유용해요.", "A filling meal keeps me full for hours.", "INTRO_PREF_MEAL"),
      word("light", "가벼운", "부담 없는 식사를 좋아할 때 써요.", "I like something light before work.", "INTRO_PREF_MEAL"),
      word("bread", "빵", "아침 메뉴를 말할 때 가장 쉽게 연결돼요.", "Bread is easy to eat in a hurry.", "INTRO_PREF_MEAL"),
      word("eggs", "계란", "간단한 식재료를 말할 때 직접적이에요.", "Eggs make breakfast more filling.", "INTRO_PREF_MEAL"),
      word("fruit", "과일", "가볍고 상큼한 메뉴를 말할 때 좋아요.", "Fruit feels fresh in the morning.", "INTRO_PREF_MEAL"),
      word("yogurt", "요거트", "간단한 아침 메뉴로 자주 써요.", "Yogurt is simple but satisfying.", "INTRO_PREF_MEAL"),
      word("toast", "토스트", "쉽고 친숙한 메뉴를 말할 때 자연스러워요.", "Toast is one of my favorite quick breakfasts.", "INTRO_PREF_MEAL"),
      word("flavor", "맛", "좋아하는 이유를 설명할 때 꼭 필요한 단어예요.", "The flavor is simple but really good.", "INTRO_PREF_MEAL"),
    ],
    phrases: [
      phrase("easy to make", "만들기 쉽다", "좋아하는 이유를 아주 쉽게 말할 수 있어요.", "It is easy to make, so I choose it often.", "INTRO_PREF_MEAL"),
      phrase("keeps me full", "배를 든든하게 해 준다", "식사류 질문에 바로 쓸 수 있는 표현이에요.", "It keeps me full until lunch.", "INTRO_PREF_MEAL"),
      phrase("goes well with", "…와 잘 어울리다", "음식 조합을 말할 때 좋아요.", "It goes well with fruit or yogurt.", "INTRO_PREF_MEAL"),
      phrase("tastes best when", "…할 때 가장 맛있다", "좋아하는 먹는 상황을 말할 때 자연스러워요.", "It tastes best when it is still warm.", "INTRO_PREF_MEAL"),
      phrase("fits my morning well", "내 아침과 잘 맞다", "루틴과 취향을 연결할 때 쓰기 좋아요.", "It fits my morning well because it is simple.", "INTRO_PREF_MEAL"),
    ],
    prompts: [
      promptSpec("prompt-preference-2201", "What is your favorite kind of bread for breakfast, and why do you like it?", "아침에 먹기 좋은 빵 종류 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite kind of bread for breakfast is ... because ..."),
      promptSpec("prompt-preference-2202", "What kind of fried eggs do you like best, and why?", "계란을 굽는 방식 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "The kind of fried eggs I like best is ... because ..."),
      promptSpec("prompt-preference-2203", "What is your favorite fruit to eat in the morning, and why do you like it?", "아침에 먹기 좋은 과일 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite fruit to eat in the morning is ... because ..."),
      promptSpec("prompt-preference-2204", "What is your favorite yogurt topping, and why do you like it?", "요거트에 올리는 토핑 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite yogurt topping is ... because ..."),
      promptSpec("prompt-preference-2205", "What is your favorite type of cereal, and why do you like it?", "시리얼 종류 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite type of cereal is ... because ..."),
      promptSpec("prompt-preference-2206", "What is your favorite jam flavor, and why do you like it?", "잼 맛 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite jam flavor is ... because ..."),
      promptSpec("prompt-preference-2207", "What is your favorite toast topping, and why do you like it?", "토스트에 올리는 것 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite toast topping is ... because ..."),
      promptSpec("prompt-preference-2208", "What is your favorite simple noodle dish, and why do you like it?", "간단한 면 요리 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite simple noodle dish is ... because ..."),
      promptSpec("prompt-preference-2209", "What is your favorite lunch box side dish, and why do you like it?", "도시락 반찬 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite lunch box side dish is ... because ..."),
      promptSpec("prompt-preference-2210", "What is your favorite simple meal to make for yourself, and why do you like it?", "혼자 간단히 만들어 먹기 좋은 음식 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite simple meal to make for myself is ... because ..."),
      promptSpec("prompt-preference-2211", "What is your favorite snack to eat with milk, and why do you like it?", "우유와 함께 먹기 좋은 간식 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite snack to eat with milk is ... because ..."),
      promptSpec("prompt-preference-2212", "What is your favorite food to eat when you are in a hurry, and why do you like it?", "바쁠 때 먹기 좋은 음식 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite food to eat when I am in a hurry is ... because ..."),
      promptSpec("prompt-preference-2213", "What is your favorite rice bowl topping, and why do you like it?", "덮밥 위에 올리는 재료 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite rice bowl topping is ... because ..."),
      promptSpec("prompt-preference-2214", "What is your favorite porridge for a quiet morning, and why do you like it?", "조용한 아침에 먹기 좋은 죽이나 포리지 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite porridge for a quiet morning is ... because ..."),
      promptSpec("prompt-preference-2215", "What is your favorite quick meal for a late morning, and why do you like it?", "늦은 오전에 빨리 먹기 좋은 음식 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite quick meal for a late morning is ... because ..."),
    ],
  },
  {
    code: "snacks-sweets",
    detailName: "Snacks and Sweets",
    detailOrder: 2,
    tip: "가볍게 먹는 간식과 좋아하는 이유를 직접적으로 말해 보세요.",
    words: [
      word("crispy", "바삭한", "간식 식감을 말할 때 아주 자연스러워요.", "I like snacks that feel crispy.", "INTRO_PREF_SNACK"),
      word("sweet", "달콤한", "맛을 간단하게 표현할 때 가장 쉬워요.", "I prefer something sweet after lunch.", "INTRO_PREF_SNACK"),
      word("salty", "짭짤한", "단맛과 구분해 취향을 말할 수 있어요.", "A salty snack feels more satisfying to me.", "INTRO_PREF_SNACK"),
      word("soft", "부드러운", "빵이나 쿠키 식감을 말할 때 좋아요.", "I like soft snacks more than hard ones.", "INTRO_PREF_SNACK"),
      word("light", "가벼운", "부담 없는 간식을 말할 때 자주 써요.", "A light snack is enough for me.", "INTRO_PREF_SNACK"),
      word("chips", "칩, 과자", "짭짤한 간식을 말할 때 직접적이에요.", "Chips are my go-to snack sometimes.", "INTRO_PREF_SNACK"),
      word("cookie", "쿠키", "달콤한 간식의 대표 단어예요.", "A cookie goes well with milk.", "INTRO_PREF_SNACK"),
      word("candy", "사탕", "작고 달콤한 간식을 말할 때 좋아요.", "Candy is easy to carry around.", "INTRO_PREF_SNACK"),
      word("cone", "콘, 아이스크림 콘", "시원한 간식을 말할 때 떠올리기 쉬운 단어예요.", "A cone is perfect on hot days.", "INTRO_PREF_SNACK"),
      word("flavor", "맛", "간식 취향의 이유를 연결할 때 꼭 필요해요.", "The flavor is simple but really good.", "INTRO_PREF_SNACK"),
    ],
    phrases: [
      phrase("easy to carry", "가지고 다니기 쉽다", "간식을 좋아하는 이유를 짧게 말할 때 좋아요.", "It is easy to carry, so I buy it often.", "INTRO_PREF_SNACK"),
      phrase("not too heavy", "너무 무겁지 않다", "부담 없는 간식이라는 점을 말할 때 좋아요.", "It is not too heavy, so I can enjoy it anytime.", "INTRO_PREF_SNACK"),
      phrase("has a nice crunch", "기분 좋은 바삭함이 있다", "식감을 말할 때 아주 자연스러워요.", "It has a nice crunch that I enjoy.", "INTRO_PREF_SNACK"),
      phrase("goes well with milk", "우유와 잘 어울리다", "쿠키나 달콤한 간식을 설명할 때 좋아요.", "It goes well with milk in the evening.", "INTRO_PREF_SNACK"),
      phrase("feels like a treat", "작은 보상처럼 느껴지다", "좋아하는 이유를 감정적으로 말할 때 좋습니다.", "It feels like a treat after a long day.", "INTRO_PREF_SNACK"),
    ],
    prompts: [
      promptSpec("prompt-preference-2216", "What is your favorite cookie flavor, and why do you like it?", "쿠키 맛 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite cookie flavor is ... because ..."),
      promptSpec("prompt-preference-2217", "What is your favorite chip flavor, and why do you like it?", "칩 맛 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite chip flavor is ... because ..."),
      promptSpec("prompt-preference-2218", "What is your favorite ice cream flavor, and why do you like it?", "아이스크림 맛 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite ice cream flavor is ... because ..."),
      promptSpec("prompt-preference-2219", "What is your favorite kind of chocolate bar, and why do you like it?", "초콜릿 바 종류 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite kind of chocolate bar is ... because ..."),
      promptSpec("prompt-preference-2220", "What is your favorite candy flavor, and why do you like it?", "사탕 맛 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite candy flavor is ... because ..."),
      promptSpec("prompt-preference-2221", "What is your favorite snack from a convenience store, and why do you like it?", "편의점 간식 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite snack from a convenience store is ... because ..."),
      promptSpec("prompt-preference-2222", "What is your favorite type of cracker, and why do you like it?", "크래커 종류 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite type of cracker is ... because ..."),
      promptSpec("prompt-preference-2223", "What is your favorite popcorn flavor, and why do you like it?", "팝콘 맛 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite popcorn flavor is ... because ..."),
      promptSpec("prompt-preference-2224", "What is your favorite sweet bread to grab on the go, and why do you like it?", "들고 가면서 먹기 좋은 달콤한 빵 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite sweet bread to grab on the go is ... because ..."),
      promptSpec("prompt-preference-2225", "What is your favorite yogurt drink flavor, and why do you like it?", "요거트 음료 맛 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite yogurt drink flavor is ... because ..."),
      promptSpec("prompt-preference-2226", "What is your favorite fruit candy, and why do you like it?", "과일 사탕 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite fruit candy is ... because ..."),
      promptSpec("prompt-preference-2227", "What is your favorite late-night snack, and why do you like it?", "밤에 먹기 좋은 간식 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite late-night snack is ... because ..."),
      promptSpec("prompt-preference-2228", "What is your favorite salty snack, and why do you like it?", "짭짤한 간식 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite salty snack is ... because ..."),
      promptSpec("prompt-preference-2229", "What is your favorite soft snack, and why do you like it?", "부드러운 간식 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite soft snack is ... because ..."),
      promptSpec("prompt-preference-2230", "What is your favorite small treat after a long day, and why do you like it?", "긴 하루 뒤 작은 보상처럼 먹기 좋은 간식 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite small treat after a long day is ... because ..."),
    ],
  },
  {
    code: "stationery-tools",
    detailName: "Stationery and Study Tools",
    detailOrder: 3,
    tip: "자주 쓰는 학습 도구와 좋아하는 이유를 간단히 말해 보세요.",
    words: [
      word("simple", "단순한", "복잡하지 않은 도구를 좋아할 때 자연스러워요.", "I like tools that feel simple.", "INTRO_PREF_TOOL"),
      word("clean", "깔끔한", "디자인이나 정리감을 말할 때 쓰기 좋아요.", "A clean design helps me focus.", "INTRO_PREF_TOOL"),
      word("small", "작은", "휴대성이 좋은 도구를 말할 때 좋아요.", "A small tool is easy to carry.", "INTRO_PREF_TOOL"),
      word("neat", "정돈된", "필기구나 책상 도구를 말할 때 잘 맞아요.", "It keeps my desk neat.", "INTRO_PREF_TOOL"),
      word("color", "색", "형광펜이나 파일 색을 말할 때 자연스러워요.", "The color makes it easy to find.", "INTRO_PREF_TOOL"),
      word("pencil", "연필", "기본 학습 도구를 말할 때 직접적이에요.", "A pencil feels easy to use.", "INTRO_PREF_TOOL"),
      word("highlighter", "형광펜", "중요한 부분을 표시하는 도구로 자주 나와요.", "A highlighter helps me review faster.", "INTRO_PREF_TOOL"),
      word("planner", "플래너", "일정 정리 도구를 말할 때 유용해요.", "My planner keeps everything in one place.", "INTRO_PREF_TOOL"),
      word("folder", "파일 폴더", "자료를 정리하는 도구를 말할 때 써요.", "A folder helps me keep papers safe.", "INTRO_PREF_TOOL"),
      word("keyboard", "키보드", "디지털 공부 도구까지 넓게 말할 수 있어요.", "A good keyboard feels comfortable to use.", "INTRO_PREF_TOOL"),
    ],
    phrases: [
      phrase("easy to carry", "가지고 다니기 쉽다", "공부 도구를 좋아하는 이유로 쓰기 좋아요.", "It is easy to carry in my bag.", "INTRO_PREF_TOOL"),
      phrase("helps me focus", "집중하게 도와준다", "도구의 장점을 직접적으로 말할 수 있어요.", "It helps me focus during study time.", "INTRO_PREF_TOOL"),
      phrase("looks clean on the desk", "책상 위에서 깔끔해 보인다", "디자인 취향을 말할 때 자연스러워요.", "It looks clean on the desk and feels calm.", "INTRO_PREF_TOOL"),
      phrase("fits my study style", "내 공부 스타일에 잘 맞다", "학습 도구를 고르는 이유를 구체적으로 말할 때 좋아요.", "It fits my study style because it stays simple.", "INTRO_PREF_TOOL"),
      phrase("I use it every day", "매일 사용한다", "자주 쓰는 도구라는 점을 강조하기 좋아요.", "I use it every day for work and study.", "INTRO_PREF_TOOL"),
    ],
    prompts: [
      promptSpec("prompt-preference-2231", "What is your favorite type of pencil, and why do you like it?", "연필 종류 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite type of pencil is ... because ..."),
      promptSpec("prompt-preference-2232", "What is your favorite kind of eraser, and why do you like it?", "지우개 종류 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite kind of eraser is ... because ..."),
      promptSpec("prompt-preference-2233", "What is your favorite highlighter color, and why do you like it?", "형광펜 색 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite highlighter color is ... because ..."),
      promptSpec("prompt-preference-2234", "What is your favorite sticky note shape, and why do you like it?", "포스트잇 모양 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite sticky note shape is ... because ..."),
      promptSpec("prompt-preference-2235", "What is your favorite planner layout, and why do you like it?", "플래너 구성 방식 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite planner layout is ... because ..."),
      promptSpec("prompt-preference-2236", "What is your favorite bookmark style, and why do you like it?", "북마크 스타일 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite bookmark style is ... because ..."),
      promptSpec("prompt-preference-2237", "What is your favorite desk organizer, and why do you like it?", "책상 정리 도구 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite desk organizer is ... because ..."),
      promptSpec("prompt-preference-2238", "What is your favorite type of ruler, and why do you like it?", "자 종류 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite type of ruler is ... because ..."),
      promptSpec("prompt-preference-2239", "What is your favorite file folder color, and why do you like it?", "파일 폴더 색 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite file folder color is ... because ..."),
      promptSpec("prompt-preference-2240", "What is your favorite small pouch for school or work, and why do you like it?", "학교나 일할 때 쓰는 작은 파우치 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite small pouch for school or work is ... because ..."),
      promptSpec("prompt-preference-2241", "What is your favorite keyboard style, and why do you like it?", "키보드 스타일 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite keyboard style is ... because ..."),
      promptSpec("prompt-preference-2242", "What is your favorite mouse shape, and why do you like it?", "마우스 모양 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite mouse shape is ... because ..."),
      promptSpec("prompt-preference-2243", "What is your favorite desk timer, and why do you like it?", "책상 위 타이머 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite desk timer is ... because ..."),
      promptSpec("prompt-preference-2244", "What is your favorite way to keep papers organized, and why do you like it?", "종이를 정리하는 방법 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite way to keep papers organized is ... because ..."),
      promptSpec("prompt-preference-2245", "What is your favorite study tool to keep near your notebook, and why do you like it?", "노트 옆에 두기 좋은 공부 도구 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite study tool to keep near my notebook is ... because ..."),
    ],
  },
  {
    code: "clothes-accessories",
    detailName: "Clothes and Accessories",
    detailOrder: 4,
    tip: "매일 쓰거나 입는 물건을 좋아하는 이유와 함께 말해 보세요.",
    words: [
      word("comfortable", "편안한", "옷이나 액세서리를 좋아하는 이유로 가장 자연스러워요.", "Comfortable clothes are best for long days.", "INTRO_PREF_STYLE"),
      word("soft", "부드러운", "천의 느낌을 말할 때 좋아요.", "Soft fabric feels better on my skin.", "INTRO_PREF_STYLE"),
      word("light", "가벼운", "매일 쓰기 편한 점을 설명할 때 유용해요.", "Light shoes are easier to wear all day.", "INTRO_PREF_STYLE"),
      word("simple", "단순한", "과하지 않은 스타일을 좋아할 때 쓰기 좋아요.", "I like simple styles more than flashy ones.", "INTRO_PREF_STYLE"),
      word("color", "색", "옷 취향을 말할 때 빠지지 않는 단어예요.", "The color goes well with many outfits.", "INTRO_PREF_STYLE"),
      word("hoodie", "후드티", "편한 상의를 말할 때 직접적이에요.", "A hoodie feels warm and easy to wear.", "INTRO_PREF_STYLE"),
      word("sneakers", "운동화", "매일 신는 신발을 말할 때 좋아요.", "Sneakers are my first choice for daily wear.", "INTRO_PREF_STYLE"),
      word("scarf", "목도리", "계절 액세서리를 말할 때 잘 맞아요.", "A scarf makes winter outfits better.", "INTRO_PREF_STYLE"),
      word("umbrella", "우산", "실용적인 소지품 취향을 말할 수 있어요.", "A small umbrella is easy to carry.", "INTRO_PREF_STYLE"),
      word("pattern", "무늬", "양말이나 잠옷 같은 물건 취향을 말할 때 좋아요.", "I like patterns that look calm, not loud.", "INTRO_PREF_STYLE"),
    ],
    phrases: [
      phrase("easy to wear", "입기 쉽다", "옷 취향의 이유를 가장 쉽게 말해 줘요.", "It is easy to wear with many things.", "INTRO_PREF_STYLE"),
      phrase("goes with everything", "어디에나 잘 어울리다", "활용도가 높은 물건을 설명할 때 좋아요.", "It goes with everything in my closet.", "INTRO_PREF_STYLE"),
      phrase("feels good all day", "하루 종일 편하다", "실용적인 장점을 말할 때 자연스러워요.", "It feels good all day, even when I walk a lot.", "INTRO_PREF_STYLE"),
      phrase("not too flashy", "너무 튀지 않다", "차분한 스타일을 좋아할 때 좋아요.", "It is not too flashy, which I like.", "INTRO_PREF_STYLE"),
      phrase("I reach for it often", "자주 손이 간다", "실제로 자주 쓰는 물건이라는 점을 강조할 수 있어요.", "I reach for it often before going out.", "INTRO_PREF_STYLE"),
    ],
    prompts: [
      promptSpec("prompt-preference-2246", "What is your favorite T-shirt color, and why do you like it?", "티셔츠 색 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite T-shirt color is ... because ..."),
      promptSpec("prompt-preference-2247", "What is your favorite hoodie style, and why do you like it?", "후드티 스타일 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite hoodie style is ... because ..."),
      promptSpec("prompt-preference-2248", "What is your favorite sock pattern, and why do you like it?", "양말 무늬 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite sock pattern is ... because ..."),
      promptSpec("prompt-preference-2249", "What is your favorite pair of sneakers for daily use, and why do you like it?", "매일 신기 좋은 운동화 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite pair of sneakers for daily use is ... because ..."),
      promptSpec("prompt-preference-2250", "What is your favorite hat for sunny days, and why do you like it?", "햇빛이 강한 날 쓰기 좋은 모자 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite hat for sunny days is ... because ..."),
      promptSpec("prompt-preference-2251", "What is your favorite scarf for winter, and why do you like it?", "겨울에 하기 좋은 목도리 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite scarf for winter is ... because ..."),
      promptSpec("prompt-preference-2252", "What is your favorite watch strap color, and why do you like it?", "시계 줄 색 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite watch strap color is ... because ..."),
      promptSpec("prompt-preference-2253", "What is your favorite pair of room slippers, and why do you like it?", "실내 슬리퍼 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite pair of room slippers is ... because ..."),
      promptSpec("prompt-preference-2254", "What is your favorite raincoat style, and why do you like it?", "우비 스타일 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite raincoat style is ... because ..."),
      promptSpec("prompt-preference-2255", "What is your favorite pajama pattern, and why do you like it?", "잠옷 무늬 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite pajama pattern is ... because ..."),
      promptSpec("prompt-preference-2256", "What is your favorite hair tie color, and why do you like it?", "머리끈 색 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite hair tie color is ... because ..."),
      promptSpec("prompt-preference-2257", "What is your favorite umbrella style, and why do you like it?", "우산 스타일 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite umbrella style is ... because ..."),
      promptSpec("prompt-preference-2258", "What is your favorite everyday jacket material, and why do you like it?", "매일 입기 좋은 재킷 소재 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite everyday jacket material is ... because ..."),
      promptSpec("prompt-preference-2259", "What is your favorite simple ring or bracelet to wear, and why do you like it?", "가볍게 착용하기 좋은 반지나 팔찌 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite simple ring or bracelet to wear is ... because ..."),
      promptSpec("prompt-preference-2260", "What is your favorite thing to wear when you want to feel relaxed, and why do you like it?", "편안한 기분이 들고 싶을 때 입기 좋은 것 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite thing to wear when I want to feel relaxed is ... because ..."),
    ],
  },
  {
    code: "home-comfort",
    detailName: "Home Comfort Items",
    detailOrder: 5,
    tip: "집에서 자주 쓰는 물건을 떠올리고 좋아하는 이유를 덧붙여 보세요.",
    words: [
      word("cozy", "아늑한", "집에서 쓰는 물건의 느낌을 말할 때 아주 좋아요.", "A cozy item makes home feel better.", "INTRO_PREF_HOME"),
      word("soft", "부드러운", "촉감을 말할 때 누구나 이해하기 쉬워요.", "Soft things help me relax.", "INTRO_PREF_HOME"),
      word("warm", "따뜻한", "집에서 편안함을 말할 때 자주 쓰는 단어예요.", "Warm items are great in the evening.", "INTRO_PREF_HOME"),
      word("simple", "단순한", "디자인이 부담 없을 때 자연스러워요.", "I like simple things at home.", "INTRO_PREF_HOME"),
      word("useful", "유용한", "자주 쓰는 이유를 짧게 설명할 때 좋아요.", "A useful item saves me time.", "INTRO_PREF_HOME"),
      word("blanket", "담요", "집에서 쉬는 물건을 말할 때 직접적이에요.", "A blanket is perfect for quiet nights.", "INTRO_PREF_HOME"),
      word("pillow", "베개", "편안함을 말할 때 쉽게 떠올릴 수 있어요.", "A good pillow helps me sleep well.", "INTRO_PREF_HOME"),
      word("mug", "머그컵", "집에서 자주 쓰는 작은 물건을 말할 때 좋아요.", "My favorite mug is easy to hold.", "INTRO_PREF_HOME"),
      word("lamp", "조명", "방 분위기를 말할 때 유용해요.", "A lamp changes the mood of the room.", "INTRO_PREF_HOME"),
      word("bottle", "물병", "실용적인 물건 취향을 설명할 때 좋아요.", "A good bottle is easy to carry around the house.", "INTRO_PREF_HOME"),
    ],
    phrases: [
      phrase("makes me feel cozy", "아늑한 기분이 들게 하다", "집에서 쓰는 물건 취향과 잘 어울려요.", "It makes me feel cozy right away.", "INTRO_PREF_HOME"),
      phrase("easy to use", "사용하기 쉽다", "실용적인 이유를 가장 쉽게 말할 수 있어요.", "It is easy to use every day.", "INTRO_PREF_HOME"),
      phrase("looks good in my room", "내 방에 잘 어울리다", "디자인 취향을 설명할 때 자연스러워요.", "It looks good in my room and feels calm.", "INTRO_PREF_HOME"),
      phrase("I use it all the time", "늘 사용한다", "자주 쓰는 물건이라는 점을 강조하기 좋아요.", "I use it all the time at home.", "INTRO_PREF_HOME"),
      phrase("makes my room feel calmer", "내 방을 더 차분하게 느끼게 하다", "집안 물건이 주는 분위기를 설명할 때 좋아요.", "It makes my room feel calmer at night.", "INTRO_PREF_HOME"),
    ],
    prompts: [
      promptSpec("prompt-preference-2261", "What is your favorite blanket at home, and why do you like it?", "집에서 쓰는 담요 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite blanket at home is ... because ..."),
      promptSpec("prompt-preference-2262", "What is your favorite pillow, and why do you like it?", "베개 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite pillow is ... because ..."),
      promptSpec("prompt-preference-2263", "What is your favorite mug, and why do you like it?", "머그컵 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite mug is ... because ..."),
      promptSpec("prompt-preference-2264", "What is your favorite bowl to use at home, and why do you like it?", "집에서 쓰는 그릇 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite bowl to use at home is ... because ..."),
      promptSpec("prompt-preference-2265", "What is your favorite lamp in your room, and why do you like it?", "방에 있는 조명 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite lamp in my room is ... because ..."),
      promptSpec("prompt-preference-2266", "What is your favorite water bottle, and why do you like it?", "물병 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite water bottle is ... because ..."),
      promptSpec("prompt-preference-2267", "What is your favorite desk mat, and why do you like it?", "책상 매트 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite desk mat is ... because ..."),
      promptSpec("prompt-preference-2268", "What is your favorite chair cushion, and why do you like it?", "의자 방석 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite chair cushion is ... because ..."),
      promptSpec("prompt-preference-2269", "What is your favorite wall calendar design, and why do you like it?", "벽 달력 디자인 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite wall calendar design is ... because ..."),
      promptSpec("prompt-preference-2270", "What is your favorite small fan for your room, and why do you like it?", "방에서 쓰는 작은 선풍기 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite small fan for my room is ... because ..."),
      promptSpec("prompt-preference-2271", "What is your favorite mirror to use while getting ready, and why do you like it?", "준비할 때 쓰는 거울 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite mirror to use while getting ready is ... because ..."),
      promptSpec("prompt-preference-2272", "What is your favorite storage basket, and why do you like it?", "수납 바구니 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite storage basket is ... because ..."),
      promptSpec("prompt-preference-2273", "What is your favorite plate to use for a quick meal, and why do you like it?", "간단한 식사에 쓰는 접시 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite plate to use for a quick meal is ... because ..."),
      promptSpec("prompt-preference-2274", "What is your favorite small item in your room that helps you relax, and why do you like it?", "방에서 쉬는 데 도움이 되는 작은 물건 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite small item in my room that helps me relax is ... because ..."),
      promptSpec("prompt-preference-2275", "What is your favorite small thing on your bedside table, and why do you like it?", "침대 옆 탁자에 두는 작은 물건 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite small thing on my bedside table is ... because ..."),
    ],
  },
  {
    code: "care-scents",
    detailName: "Personal Care and Scents",
    detailOrder: 6,
    tip: "향이나 사용감처럼 직접 느끼는 이유를 짧게 설명해 보세요.",
    words: [
      word("fresh", "상쾌한", "향을 좋아하는 이유로 가장 쉽게 말할 수 있어요.", "A fresh scent wakes me up a little.", "INTRO_PREF_CARE"),
      word("clean", "깔끔한", "비누나 샴푸 향을 설명할 때 자연스러워요.", "I like clean scents more than sweet ones.", "INTRO_PREF_CARE"),
      word("soft", "은은한, 부드러운", "강하지 않은 향을 말할 때 좋아요.", "A soft scent feels calm and easy.", "INTRO_PREF_CARE"),
      word("mild", "순한", "사용감이 편안할 때 쓰기 좋아요.", "I prefer something mild on my skin.", "INTRO_PREF_CARE"),
      word("smooth", "부드러운", "로션이나 크림 느낌을 말할 때 좋아요.", "A smooth lotion feels nice after a shower.", "INTRO_PREF_CARE"),
      word("soap", "비누", "세정 제품을 말할 때 기본이 되는 단어예요.", "Soap with a light scent is my favorite.", "INTRO_PREF_CARE"),
      word("shampoo", "샴푸", "머리 감을 때 쓰는 제품을 직접적으로 말해 줘요.", "My shampoo has a fresh smell.", "INTRO_PREF_CARE"),
      word("lotion", "로션", "보습 제품 취향을 말할 때 유용해요.", "Lotion is a must in dry weather.", "INTRO_PREF_CARE"),
      word("balm", "밤, 립밤", "작고 실용적인 제품을 말할 때 자연스러워요.", "A lip balm is always in my bag.", "INTRO_PREF_CARE"),
      word("scent", "향", "좋아하는 이유를 연결하는 핵심 단어예요.", "The scent is the main reason I choose it.", "INTRO_PREF_CARE"),
    ],
    phrases: [
      phrase("smells clean", "깔끔한 향이 나다", "세정 제품 취향을 말할 때 아주 쉬워요.", "It smells clean and not too strong.", "INTRO_PREF_CARE"),
      phrase("not too strong", "향이 너무 강하지 않다", "향 제품을 좋아하는 이유로 자주 써요.", "It is not too strong, so I use it every day.", "INTRO_PREF_CARE"),
      phrase("feels soft on my skin", "피부에 부드럽게 느껴지다", "사용감을 설명할 때 자연스러워요.", "It feels soft on my skin after I use it.", "INTRO_PREF_CARE"),
      phrase("feels gentle on my skin", "피부에 순하게 느껴지다", "관리 제품의 사용감을 더 직접적으로 말할 수 있어요.", "It feels gentle on my skin, so I use it often.", "INTRO_PREF_CARE"),
      phrase("I never get tired of it", "질리지 않는다", "오랫동안 좋아하는 제품을 말할 때 좋아요.", "I never get tired of it because the scent is simple.", "INTRO_PREF_CARE"),
    ],
    prompts: [
      promptSpec("prompt-preference-2276", "What is your favorite hand cream scent, and why do you like it?", "핸드크림 향 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite hand cream scent is ... because ..."),
      promptSpec("prompt-preference-2277", "What is your favorite soap scent, and why do you like it?", "비누 향 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite soap scent is ... because ..."),
      promptSpec("prompt-preference-2278", "What is your favorite shampoo scent, and why do you like it?", "샴푸 향 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite shampoo scent is ... because ..."),
      promptSpec("prompt-preference-2279", "What is your favorite lip balm flavor or scent, and why do you like it?", "립밤 향이나 맛 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite lip balm flavor or scent is ... because ..."),
      promptSpec("prompt-preference-2280", "What is your favorite body wash scent, and why do you like it?", "바디워시 향 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite body wash scent is ... because ..."),
      promptSpec("prompt-preference-2281", "What is your favorite lotion texture, and why do you like it?", "로션 질감 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite lotion texture is ... because ..."),
      promptSpec("prompt-preference-2282", "What is your favorite scent of freshly washed towels, and why do you like it?", "갓 빨아 말린 수건 냄새 중에서 가장 좋아하는 느낌은 무엇이고, 왜 좋아하나요?", "My favorite scent of freshly washed towels is ... because ..."),
      promptSpec("prompt-preference-2283", "What is your favorite bath salt scent, and why do you like it?", "입욕제 향 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite bath salt scent is ... because ..."),
      promptSpec("prompt-preference-2284", "What is your favorite sunscreen type, and why do you like it?", "선크림 타입 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite sunscreen type is ... because ..."),
      promptSpec("prompt-preference-2285", "What is your favorite face mask sheet type, and why do you like it?", "시트 마스크 종류 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite face mask sheet type is ... because ..."),
      promptSpec("prompt-preference-2286", "What is your favorite toothpaste flavor, and why do you like it?", "치약 맛 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite toothpaste flavor is ... because ..."),
      promptSpec("prompt-preference-2287", "What is your favorite room spray scent, and why do you like it?", "룸 스프레이 향 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite room spray scent is ... because ..."),
      promptSpec("prompt-preference-2288", "What is your favorite hair oil scent, and why do you like it?", "헤어 오일 향 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite hair oil scent is ... because ..."),
      promptSpec("prompt-preference-2289", "What is your favorite laundry detergent scent, and why do you like it?", "세제 향 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite laundry detergent scent is ... because ..."),
      promptSpec("prompt-preference-2290", "What is your favorite kind of personal care product to use before bed, and why do you like it?", "잠들기 전에 쓰기 좋은 관리 제품 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite kind of personal care product to use before bed is ... because ..."),
    ],
  },
  {
    code: "digital-features",
    detailName: "Digital Features",
    detailOrder: 7,
    tip: "앱이나 휴대폰의 어떤 점이 편한지 직접적으로 말해 보세요.",
    words: [
      word("useful", "유용한", "디지털 기능을 좋아하는 이유로 가장 무난해요.", "It is useful in daily life.", "INTRO_PREF_DIGITAL"),
      word("simple", "단순한", "복잡하지 않은 기능을 설명할 때 좋아요.", "Simple features save me time.", "INTRO_PREF_DIGITAL"),
      word("clear", "분명한, 보기 쉬운", "화면 구성이 좋은 이유를 말할 때 좋아요.", "The screen looks clear and easy to use.", "INTRO_PREF_DIGITAL"),
      word("fast", "빠른", "앱 반응 속도를 말할 때 직접적이에요.", "A fast feature makes life easier.", "INTRO_PREF_DIGITAL"),
      word("helpful", "도움이 되는", "실생활에서 쓰는 이유를 설명할 때 써요.", "This feature is helpful every day.", "INTRO_PREF_DIGITAL"),
      word("calendar", "달력", "일정 앱 기능을 말할 때 자연스러워요.", "The calendar view helps me stay organized.", "INTRO_PREF_DIGITAL"),
      word("alarm", "알람", "휴대폰 기본 기능 취향을 말할 때 좋아요.", "A gentle alarm sound works best for me.", "INTRO_PREF_DIGITAL"),
      word("widget", "위젯", "화면 구성 취향을 말할 수 있어요.", "A widget lets me see information quickly.", "INTRO_PREF_DIGITAL"),
      word("filter", "필터", "사진 앱 취향을 설명할 때 유용해요.", "A soft filter looks better to me.", "INTRO_PREF_DIGITAL"),
      word("theme", "테마", "배경이나 색 구성 취향을 말할 때 자연스러워요.", "A simple theme feels cleaner.", "INTRO_PREF_DIGITAL"),
    ],
    phrases: [
      phrase("easy to check at a glance", "한눈에 확인하기 쉽다", "화면 구성의 장점을 말할 때 좋아요.", "It is easy to check at a glance, so I like it.", "INTRO_PREF_DIGITAL"),
      phrase("saves me time", "시간을 아껴 준다", "실용적인 이유를 말할 때 가장 쉬워요.", "It saves me time every single day.", "INTRO_PREF_DIGITAL"),
      phrase("looks clean on the screen", "화면에서 깔끔해 보이다", "디자인 취향을 설명할 때 자연스러워요.", "It looks clean on the screen and feels calm.", "INTRO_PREF_DIGITAL"),
      phrase("works the way I want", "내가 원하는 방식으로 작동하다", "개인 취향과 기능성을 연결할 때 좋아요.", "It works the way I want, so I keep using it.", "INTRO_PREF_DIGITAL"),
      phrase("I use it without thinking", "생각하지 않고도 자주 쓰게 되다", "익숙하고 편한 기능이라는 뜻을 줄 수 있어요.", "I use it without thinking because it is so easy.", "INTRO_PREF_DIGITAL"),
    ],
    prompts: [
      promptSpec("prompt-preference-2291", "What is your favorite phone wallpaper style, and why do you like it?", "휴대폰 배경화면 스타일 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite phone wallpaper style is ... because ..."),
      promptSpec("prompt-preference-2292", "What is your favorite alarm sound, and why do you like it?", "알람 소리 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite alarm sound is ... because ..."),
      promptSpec("prompt-preference-2293", "What is your favorite calendar view on your phone, and why do you like it?", "휴대폰 달력 보기 방식 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite calendar view on my phone is ... because ..."),
      promptSpec("prompt-preference-2294", "What is your favorite quick capture feature in a note-taking app, and why do you like it?", "메모 앱에서 빠르게 적어 두는 기능 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite quick capture feature in a note-taking app is ... because ..."),
      promptSpec("prompt-preference-2295", "What is your favorite messaging sticker style, and why do you like it?", "메시지 스티커 스타일 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite messaging sticker style is ... because ..."),
      promptSpec("prompt-preference-2296", "What is your favorite music app feature for making a queue, and why do you like it?", "음악 앱에서 재생 목록 순서를 만드는 기능 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite music app feature for making a queue is ... because ..."),
      promptSpec("prompt-preference-2297", "What is your favorite photo filter, and why do you like it?", "사진 필터 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite photo filter is ... because ..."),
      promptSpec("prompt-preference-2298", "What is your favorite map app feature for checking your route or arrival time, and why do you like it?", "지도 앱에서 길이나 도착 시간을 확인하는 기능 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite map app feature for checking my route or arrival time is ... because ..."),
      promptSpec("prompt-preference-2299", "What is your favorite weather app view, and why do you like it?", "날씨 앱 보기 방식 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite weather app view is ... because ..."),
      promptSpec("prompt-preference-2300", "What is your favorite keyboard theme, and why do you like it?", "키보드 테마 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite keyboard theme is ... because ..."),
      promptSpec("prompt-preference-2301", "What is your favorite shortcut button on your phone, and why do you like it?", "휴대폰 바로가기 버튼 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite shortcut button on my phone is ... because ..."),
      promptSpec("prompt-preference-2302", "What is your favorite playlist cover style, and why do you like it?", "플레이리스트 표지 스타일 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite playlist cover style is ... because ..."),
      promptSpec("prompt-preference-2303", "What is your favorite reminder app feature for repeating or snoozing reminders, and why do you like it?", "리마인더 앱에서 반복이나 미루기 기능 중 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite reminder app feature for repeating or snoozing reminders is ... because ..."),
      promptSpec("prompt-preference-2304", "What is your favorite phone widget, and why do you like it?", "휴대폰 위젯 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite phone widget is ... because ..."),
      promptSpec("prompt-preference-2305", "What is your favorite app feature to use in the morning, and why do you like it?", "아침에 쓰기 좋은 앱 기능 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite app feature to use in the morning is ... because ..."),
    ],
  },
  {
    code: "simple-places",
    detailName: "Neighborhood and Simple Places",
    detailOrder: 8,
    tip: "가까운 장소를 떠올리고 편한 이유를 한두 가지 말해 보세요.",
    words: [
      word("quiet", "조용한", "장소를 좋아하는 이유로 가장 쉽게 쓸 수 있어요.", "I like places that feel quiet.", "INTRO_PREF_PLACE"),
      word("nearby", "가까운", "집 근처라서 좋다는 이유를 말할 때 좋아요.", "A nearby place is easy to visit often.", "INTRO_PREF_PLACE"),
      word("comfortable", "편안한", "장소 분위기를 말할 때 자연스러워요.", "The place feels comfortable and familiar.", "INTRO_PREF_PLACE"),
      word("bright", "밝은", "햇빛이나 조명 덕분에 좋을 때 유용해요.", "A bright place lifts my mood.", "INTRO_PREF_PLACE"),
      word("fresh", "상쾌한", "공기나 분위기를 말할 때 좋아요.", "Fresh air makes the place better.", "INTRO_PREF_PLACE"),
      word("bench", "벤치", "앉는 장소를 말할 때 직접적이에요.", "The bench is simple but comfortable.", "INTRO_PREF_PLACE"),
      word("street", "거리", "집 근처 길을 말할 때 자연스러워요.", "The street is quiet in the evening.", "INTRO_PREF_PLACE"),
      word("market", "시장", "동네 장소를 말할 때 쓰기 좋아요.", "The market feels lively but friendly.", "INTRO_PREF_PLACE"),
      word("window", "창가", "앉는 자리 취향과 연결하기 쉬워요.", "I like places near a window.", "INTRO_PREF_PLACE"),
      word("sunset", "노을", "좋아하는 시간대의 장소를 말할 때 좋아요.", "Sunset makes the place even better.", "INTRO_PREF_PLACE"),
    ],
    phrases: [
      phrase("close to home", "집에서 가깝다", "장소를 자주 가는 이유로 쓰기 좋아요.", "It is close to home, so I go there often.", "INTRO_PREF_PLACE"),
      phrase("easy to stop by", "잠깐 들르기 쉽다", "가벼운 장소 취향과 잘 어울려요.", "It is easy to stop by on the way home.", "INTRO_PREF_PLACE"),
      phrase("has a calm feeling", "차분한 느낌이 있다", "분위기를 부드럽게 설명할 때 좋아요.", "The place has a calm feeling that I enjoy.", "INTRO_PREF_PLACE"),
      phrase("I feel relaxed there", "거기 있으면 편안하다", "장소를 좋아하는 감정을 직접적으로 말할 수 있어요.", "I feel relaxed there, even on busy days.", "INTRO_PREF_PLACE"),
      phrase("I can stay there for a while", "거기에 잠깐 머무를 수 있다", "잠시 쉬기 좋은 장소임을 말할 때 좋아요.", "I can stay there for a while without feeling bored.", "INTRO_PREF_PLACE"),
    ],
    prompts: [
      promptSpec("prompt-preference-2306", "What is your favorite bench in a small park, and why do you like it?", "작은 공원 벤치 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite bench in a small park is ... because ..."),
      promptSpec("prompt-preference-2307", "What is your favorite aisle in a convenience store, and why do you like it?", "편의점에서 가장 좋아하는 진열 구역은 무엇이고, 왜 좋아하나요?", "My favorite aisle in a convenience store is ... because ..."),
      promptSpec("prompt-preference-2308", "What is your favorite street near your home to walk on, and why do you like it?", "집 근처에서 걷기 좋은 길 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite street near my home to walk on is ... because ..."),
      promptSpec("prompt-preference-2309", "What is your favorite flower stand near your home, and why do you like it?", "집 근처 꽃 가게나 꽃 코너 중에서 가장 좋아하는 곳은 무엇이고, 왜 좋아하나요?", "My favorite flower stand near my home is ... because ..."),
      promptSpec("prompt-preference-2310", "What is your favorite bus stop near your home, and why do you like it?", "집 근처 버스 정류장 중에서 가장 좋아하는 곳은 무엇이고, 왜 좋아하나요?", "My favorite bus stop near my home is ... because ..."),
      promptSpec("prompt-preference-2311", "What is your favorite seat near a train window, and why do you like it?", "기차 창가 쪽 자리 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite seat near a train window is ... because ..."),
      promptSpec("prompt-preference-2312", "What is your favorite fruit stand near home, and why do you like it?", "집 근처 과일 가게 중에서 가장 좋아하는 곳은 무엇이고, 왜 좋아하나요?", "My favorite fruit stand near home is ... because ..."),
      promptSpec("prompt-preference-2313", "What is your favorite path to the grocery store, and why do you like it?", "마트로 가는 길 중에서 가장 좋아하는 길은 무엇이고, 왜 좋아하나요?", "My favorite path to the grocery store is ... because ..."),
      promptSpec("prompt-preference-2314", "What is your favorite part of a market to visit first, and why do you like it?", "시장에서 먼저 가기 좋은 곳 중에서 가장 좋아하는 곳은 무엇이고, 왜 좋아하나요?", "My favorite part of a market to visit first is ... because ..."),
      promptSpec("prompt-preference-2315", "What is your favorite vending machine near your home, and why do you like it?", "집 근처 자판기 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite vending machine near my home is ... because ..."),
      promptSpec("prompt-preference-2316", "What is your favorite playground bench, and why do you like it?", "놀이터 벤치 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite playground bench is ... because ..."),
      promptSpec("prompt-preference-2317", "What is your favorite nearby place to watch the sunset, and why do you like it?", "가까운 곳에서 노을 보기 좋은 장소 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite nearby place to watch the sunset is ... because ..."),
      promptSpec("prompt-preference-2318", "What is your favorite place near a window to sit, and why do you like it?", "창가 근처에 앉기 좋은 자리 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite place near a window to sit is ... because ..."),
      promptSpec("prompt-preference-2319", "What is your favorite small place to stop by on the way home, and why do you like it?", "집에 가는 길에 잠깐 들르기 좋은 곳 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite small place to stop by on the way home is ... because ..."),
      promptSpec("prompt-preference-2320", "What is your favorite nearby place when you want a little fresh air, and why do you like it?", "바람을 조금 쐬고 싶을 때 가기 좋은 가까운 곳 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite nearby place when I want a little fresh air is ... because ..."),
    ],
  },
  {
    code: "light-leisure",
    detailName: "Light Leisure",
    detailOrder: 9,
    tip: "부담 없이 즐기는 활동을 떠올리고 왜 좋은지 설명해 보세요.",
    words: [
      word("fun", "재미있는", "활동을 좋아하는 이유로 가장 쉽게 말할 수 있어요.", "It is fun and easy to enjoy.", "INTRO_PREF_LEISURE"),
      word("calm", "차분한", "조용한 취미나 콘텐츠를 말할 때 좋아요.", "I like calm activities on quiet days.", "INTRO_PREF_LEISURE"),
      word("easy", "쉬운", "부담 없는 활동을 설명할 때 자연스러워요.", "Easy activities are best after work.", "INTRO_PREF_LEISURE"),
      word("creative", "창의적인", "만들기나 꾸미기 활동에 잘 맞아요.", "Creative hobbies make my time better.", "INTRO_PREF_LEISURE"),
      word("short", "짧은", "짧게 즐기는 콘텐츠를 말할 때 좋아요.", "I enjoy short activities during breaks.", "INTRO_PREF_LEISURE"),
      word("puzzle", "퍼즐", "가벼운 놀이를 말할 때 직접적이에요.", "A simple puzzle is good for quiet time.", "INTRO_PREF_LEISURE"),
      word("podcast", "팟캐스트", "듣는 취미를 말할 때 유용해요.", "A podcast is easy to enjoy while walking.", "INTRO_PREF_LEISURE"),
      word("video", "영상", "가볍게 보는 콘텐츠를 말할 때 좋아요.", "A short video can change my mood.", "INTRO_PREF_LEISURE"),
      word("coloring", "색칠하기", "손을 쓰는 활동 취향을 말할 때 자연스러워요.", "Coloring helps me slow down.", "INTRO_PREF_LEISURE"),
      word("sound", "소리", "듣기 취향을 말할 때 넓게 쓸 수 있어요.", "Soft sounds help me relax.", "INTRO_PREF_LEISURE"),
    ],
    phrases: [
      phrase("good for a short break", "짧은 쉬는 시간에 좋다", "가볍게 즐기는 활동의 장점을 말할 때 좋아요.", "It is good for a short break when I feel tired.", "INTRO_PREF_LEISURE"),
      phrase("good when I want to slow down", "천천히 쉬고 싶을 때 좋다", "차분한 활동을 좋아하는 이유를 더 직접적으로 말할 수 있어요.", "It is good when I want to slow down after work.", "INTRO_PREF_LEISURE"),
      phrase("easy to start", "바로 시작하기 쉽다", "부담 없이 시작할 수 있다는 점을 말할 때 좋아요.", "It is easy to start, even when I feel lazy.", "INTRO_PREF_LEISURE"),
      phrase("keeps my hands busy", "손이 심심하지 않게 해 준다", "가볍게 손을 쓰는 활동을 설명할 때 자연스러워요.", "It keeps my hands busy and my mind calm.", "INTRO_PREF_LEISURE"),
      phrase("fits a quiet evening", "조용한 저녁과 잘 어울리다", "차분한 취미 분위기를 말할 때 좋아요.", "It fits a quiet evening better than loud activities.", "INTRO_PREF_LEISURE"),
    ],
    prompts: [
      promptSpec("prompt-preference-2321", "What is your favorite kind of simple puzzle, and why do you like it?", "간단한 퍼즐 종류 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite kind of simple puzzle is ... because ..."),
      promptSpec("prompt-preference-2322", "What is your favorite card game to play casually, and why do you like it?", "가볍게 하기 좋은 카드 게임 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite card game to play casually is ... because ..."),
      promptSpec("prompt-preference-2323", "What is your favorite type of YouTube video to watch for fun, and why do you like it?", "재미로 보기 좋은 유튜브 영상 종류 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite type of YouTube video to watch for fun is ... because ..."),
      promptSpec("prompt-preference-2324", "What is your favorite podcast topic, and why do you like it?", "팟캐스트 주제 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite podcast topic is ... because ..."),
      promptSpec("prompt-preference-2325", "What is your favorite coloring tool, and why do you like it?", "색칠할 때 쓰는 도구 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite coloring tool is ... because ..."),
      promptSpec("prompt-preference-2326", "What is your favorite craft material, and why do you like it?", "만들기 재료 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite craft material is ... because ..."),
      promptSpec("prompt-preference-2327", "What is your favorite simple photo edit, and why do you like it?", "사진을 간단히 손볼 때 가장 좋아하는 보정은 무엇이고, 왜 좋아하나요?", "My favorite simple photo edit is ... because ..."),
      promptSpec("prompt-preference-2328", "What is your favorite quick activity for a ten-minute break, and why do you like it?", "10분 정도 쉬는 시간에 하기 좋은 빠른 활동 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite quick activity for a ten-minute break is ... because ..."),
      promptSpec("prompt-preference-2329", "What is your favorite small hobby for rainy days, and why do you like it?", "비 오는 날 하기 좋은 작은 취미 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite small hobby for rainy days is ... because ..."),
      promptSpec("prompt-preference-2330", "What is your favorite relaxing sound, and why do you like it?", "편안하게 해 주는 소리 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite relaxing sound is ... because ..."),
      promptSpec("prompt-preference-2331", "What is your favorite indoor activity on hot days, and why do you like it?", "더운 날 실내에서 하기 좋은 활동 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite indoor activity on hot days is ... because ..."),
      promptSpec("prompt-preference-2332", "What is your favorite small thing to do while waiting in line, and why do you like it?", "줄을 서서 기다릴 때 하기 좋은 작은 활동 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite small thing to do while waiting in line is ... because ..."),
      promptSpec("prompt-preference-2333", "What is your favorite kind of short video for learning something new, and why do you like it?", "새로운 것을 배울 때 보기 좋은 짧은 영상 종류 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite kind of short video for learning something new is ... because ..."),
      promptSpec("prompt-preference-2334", "What is your favorite simple activity to do with a friend at home, and why do you like it?", "집에서 친구와 함께 하기 좋은 간단한 활동 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite simple activity to do with a friend at home is ... because ..."),
      promptSpec("prompt-preference-2335", "What is your favorite hobby to start on a quiet evening at home, and why do you like it?", "집에서 조용한 저녁에 바로 시작하기 좋은 취미 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?", "My favorite hobby to start on a quiet evening at home is ... because ..."),
    ],
  },
];

const allPacks = [
  ...routinePacks.map((pack) => ({
    ...pack,
    family: "routine",
    categoryVar: "@intro_routine_category_id",
    categoryName: "Intro Routine",
    categoryOrder: 501,
  })),
  ...preferencePacks.map((pack) => ({
    ...pack,
    family: "preference",
    categoryVar: "@intro_preference_category_id",
    categoryName: "Intro Preference",
    categoryOrder: 502,
  })),
];

function buildHintRows(prompt, familyCode, words, phrases) {
  const compactId = prompt.id.replace("prompt-", "");
  const starterHintId = `hint-${compactId}-1`;
  const wordHintId = `hint-${compactId}-2`;
  const phraseHintId = `hint-${compactId}-3`;
  const isRoutine = prompt.id.startsWith("prompt-routine-");

  const rows = [];

  rows.push(
    `INSERT INTO prompt_hints (id, prompt_id, hint_type, title, display_order, is_active)` +
      ` VALUES (${sql(starterHintId)}, ${sql(prompt.id)}, 'STARTER', '첫 문장 스타터', 1, 1)` +
      ` ON DUPLICATE KEY UPDATE prompt_id = VALUES(prompt_id), hint_type = VALUES(hint_type), title = VALUES(title), display_order = VALUES(display_order), is_active = VALUES(is_active);`
  );
  rows.push(
    `INSERT INTO prompt_hints (id, prompt_id, hint_type, title, display_order, is_active)` +
      ` VALUES (${sql(wordHintId)}, ${sql(prompt.id)}, 'VOCAB_WORD', '활용 단어', 2, 1)` +
      ` ON DUPLICATE KEY UPDATE prompt_id = VALUES(prompt_id), hint_type = VALUES(hint_type), title = VALUES(title), display_order = VALUES(display_order), is_active = VALUES(is_active);`
  );
  rows.push(
    `INSERT INTO prompt_hints (id, prompt_id, hint_type, title, display_order, is_active)` +
      ` VALUES (${sql(phraseHintId)}, ${sql(prompt.id)}, 'VOCAB_PHRASE', '활용 표현', 3, 1)` +
      ` ON DUPLICATE KEY UPDATE prompt_id = VALUES(prompt_id), hint_type = VALUES(hint_type), title = VALUES(title), display_order = VALUES(display_order), is_active = VALUES(is_active);`
  );

  const starterItem = frame(
    prompt.starter,
    isRoutine ? "나는 보통 ..." : "내가 가장 좋아하는 것은 ...이고, 이유는 ...",
    isRoutine
      ? "평소 하는 행동을 바로 한 문장으로 시작해 보세요."
      : "좋아하는 대상과 이유를 한 문장으로 먼저 말해 보세요.",
    isRoutine
      ? "I usually do one or two simple things that fit my usual routine."
      : "My favorite one is something simple and familiar because it fits me well.",
    isRoutine ? "STARTER_ROUTINE" : "STARTER_PREFERENCE"
  );

  rows.push(buildHintItemInsert(`${starterHintId}-item-1`, starterHintId, starterItem, 1));

  words.forEach((item, index) => {
    rows.push(buildHintItemInsert(`${wordHintId}-item-${index + 1}`, wordHintId, item, index + 1));
  });

  phrases.forEach((item, index) => {
    rows.push(buildHintItemInsert(`${phraseHintId}-item-${index + 1}`, phraseHintId, item, index + 1));
  });

  return rows;
}

function buildHintItemInsert(id, hintId, item, displayOrder) {
  return (
    `INSERT INTO prompt_hint_items (id, hint_id, item_type, content, meaning_ko, usage_tip_ko, example_en, expression_family, display_order, is_active)` +
    ` VALUES (` +
    `${sql(id)}, ${sql(hintId)}, ${sql(item.itemType)}, ${sql(item.content)}, ${sql(item.meaningKo)}, ${sql(item.usageTipKo)}, ${sql(item.exampleEn)}, ${sql(item.expressionFamily)}, ${displayOrder}, 1)` +
    ` ON DUPLICATE KEY UPDATE hint_id = VALUES(hint_id), item_type = VALUES(item_type), content = VALUES(content), meaning_ko = VALUES(meaning_ko), usage_tip_ko = VALUES(usage_tip_ko), example_en = VALUES(example_en), expression_family = VALUES(expression_family), display_order = VALUES(display_order), is_active = VALUES(is_active);`
  );
}

function generateSql() {
  const lines = [];
  lines.push("-- Seed 270 additional intro prompts so the final intro pool reaches 300 after existing reclassification migrations.");
  lines.push("-- Generated by tools/prompt-seed/generate_intro_prompt_migration.mjs");
  lines.push("");
  lines.push("SET NAMES utf8mb4;");
  lines.push("");
  lines.push("START TRANSACTION;");
  lines.push("");
  lines.push(
    `INSERT INTO prompt_topic_categories (name, display_order, is_active) VALUES ('Intro Routine', 501, 1)` +
      ` ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), display_order = VALUES(display_order), is_active = VALUES(is_active);`
  );
  lines.push("SET @intro_routine_category_id = LAST_INSERT_ID();");
  lines.push(
    `INSERT INTO prompt_topic_categories (name, display_order, is_active) VALUES ('Intro Preference', 502, 1)` +
      ` ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), display_order = VALUES(display_order), is_active = VALUES(is_active);`
  );
  lines.push("SET @intro_preference_category_id = LAST_INSERT_ID();");
  lines.push("");

  let displayOrder = 6001;

  for (const pack of allPacks) {
    const detailVar = `@detail_${pack.family}_${pack.code.replace(/-/g, "_")}_id`;
    lines.push(`-- ${pack.detailName}`);
    lines.push(
      `INSERT INTO prompt_topic_details (category_id, name, display_order, is_active)` +
        ` VALUES (${pack.categoryVar}, ${sql(pack.detailName)}, ${pack.detailOrder}, 1)` +
        ` ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), display_order = VALUES(display_order), is_active = VALUES(is_active);`
    );
    lines.push(`SET ${detailVar} = LAST_INSERT_ID();`);

    for (const prompt of pack.prompts) {
      lines.push(
        `INSERT INTO prompts (id, topic_detail_id, difficulty, question_en, question_ko, tip, display_order, is_active)` +
          ` VALUES (${sql(prompt.id)}, ${detailVar}, 'I', ${sql(prompt.questionEn)}, ${sql(prompt.questionKo)}, ${sql(pack.tip)}, ${displayOrder}, 1)` +
          ` ON DUPLICATE KEY UPDATE topic_detail_id = VALUES(topic_detail_id), difficulty = VALUES(difficulty), question_en = VALUES(question_en), question_ko = VALUES(question_ko), tip = VALUES(tip), display_order = VALUES(display_order), is_active = VALUES(is_active);`
      );
      lines.push(...buildHintRows(prompt, pack.code.toUpperCase().replace(/-/g, "_"), pack.words, pack.phrases));
      displayOrder += 1;
    }
    lines.push("");
  }

  lines.push("COMMIT;");
  lines.push("");
  return lines.join("\n");
}

function countPrompts() {
  return allPacks.reduce((sum, pack) => sum + pack.prompts.length, 0);
}

const generatedCount = countPrompts();
if (generatedCount !== 270) {
  throw new Error(`Expected 270 generated intro prompts, found ${generatedCount}.`);
}

const sqlText = generateSql();
fs.mkdirSync(path.dirname(OUTPUT_SQL), { recursive: true });
fs.writeFileSync(OUTPUT_SQL, sqlText, "utf8");

console.log(`Generated ${generatedCount} intro prompts into ${OUTPUT_SQL}`);
