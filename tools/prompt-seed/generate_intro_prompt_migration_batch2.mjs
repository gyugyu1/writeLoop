import fs from "fs";
import path from "path";

const OUTPUT_SQL = path.join("infra", "mysql", "schema", "056-seed-more-intro-prompts.sql");

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

function beforePrompt(id, cueEn, cueKo) {
  return promptSpec(
    id,
    `What do you usually do before ${cueEn}?`,
    `${cueKo} 전에 보통 무엇을 하나요?`,
    `Before ${cueEn}, I usually ...`
  );
}

function afterPrompt(id, cueEn, cueKo) {
  return promptSpec(
    id,
    `What do you usually do after ${cueEn}?`,
    `${cueKo} 뒤에 보통 무엇을 하나요?`,
    `After ${cueEn}, I usually ...`
  );
}

function whenPrompt(id, cueEn, cueKo) {
  return promptSpec(
    id,
    `When ${cueEn}, what do you usually do?`,
    `${cueKo} 때 보통 무엇을 하나요?`,
    `When ${cueEn}, I usually ...`
  );
}

function whilePrompt(id, cueEn, cueKo) {
  return promptSpec(
    id,
    `While ${cueEn}, what do you usually do?`,
    `${cueKo} 보통 무엇을 하나요?`,
    `While ${cueEn}, I usually ...`
  );
}

function favoritePrompt(id, subjectEn, subjectKo) {
  return promptSpec(
    id,
    `What is your favorite ${subjectEn}, and why do you like it?`,
    `${subjectKo} 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?`,
    `My favorite ${subjectEn} is ... because ...`
  );
}

function sql(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

const routinePacks = [
  {
    code: "weather-ready",
    detailName: "Weather Ready",
    detailOrder: 10,
    tip: "날씨 때문에 준비가 달라지는 순간을 떠올리고 보통 하는 행동을 말해 보세요.",
    words: [
      word("forecast", "일기예보", "밖에 나가기 전 준비를 말할 때 자연스럽게 쓸 수 있어요.", "I check the forecast before I leave home.", "INTRO_ROUTINE_WEATHER"),
      word("umbrella", "우산", "비 오는 날 준비를 말할 때 바로 떠올리기 좋은 단어예요.", "I keep an umbrella near the door.", "INTRO_ROUTINE_WEATHER"),
      word("jacket", "재킷", "날씨에 맞게 겉옷을 고르는 장면과 잘 맞아요.", "I wear a light jacket on cool days.", "INTRO_ROUTINE_WEATHER"),
      word("scarf", "목도리", "추운 날 밖에 나가기 전에 하는 준비를 말할 수 있어요.", "A scarf helps me stay warm in the morning.", "INTRO_ROUTINE_WEATHER"),
      word("raincoat", "우비", "비가 올 때 특별히 챙기는 옷을 말하기 좋아요.", "I wear a raincoat on very wet days.", "INTRO_ROUTINE_WEATHER"),
      word("boots", "장화, 부츠", "젖은 날씨에 신는 신발을 말할 때 자연스러워요.", "Boots are useful on rainy days.", "INTRO_ROUTINE_WEATHER"),
      word("hoodie", "후드티", "쌀쌀한 날 가볍게 입는 옷을 말할 때 좋아요.", "A hoodie is enough on a cool evening.", "INTRO_ROUTINE_WEATHER"),
      word("puddle", "물웅덩이", "밖의 상태를 보고 행동을 바꾸는 장면을 만들 수 있어요.", "I notice puddles near the gate after rain.", "INTRO_ROUTINE_WEATHER"),
      word("chilly", "쌀쌀한", "기온이 약간 낮을 때의 느낌을 쉽게 말할 수 있어요.", "It feels chilly in the early morning.", "INTRO_ROUTINE_WEATHER"),
      word("weather", "날씨", "밖에 나가기 전 준비의 이유를 말할 때 기본이 되는 단어예요.", "The weather changes quickly in spring.", "INTRO_ROUTINE_WEATHER"),
    ],
    phrases: [
      phrase("check the forecast", "일기예보를 확인하다", "나가기 전 준비를 설명할 때 아주 자주 쓸 수 있어요.", "I check the forecast before I choose my clothes.", "INTRO_ROUTINE_WEATHER"),
      phrase("grab an umbrella", "우산을 집어 들다", "비 오는 날 급하게 준비하는 흐름을 말하기 좋아요.", "I grab an umbrella before I go outside.", "INTRO_ROUTINE_WEATHER"),
      phrase("put on a jacket", "재킷을 입다", "날씨에 맞는 겉옷 준비를 말할 때 자연스러워요.", "I put on a jacket when the wind feels cold.", "INTRO_ROUTINE_WEATHER"),
      phrase("wear waterproof shoes", "방수되는 신발을 신다", "젖은 길에 맞는 신발을 고르는 장면과 잘 맞아요.", "I wear waterproof shoes on rainy mornings.", "INTRO_ROUTINE_WEATHER"),
      phrase("leave a little early", "조금 일찍 나가다", "날씨 때문에 여유 있게 움직이는 이유를 붙이기 좋아요.", "I leave a little early when it rains heavily.", "INTRO_ROUTINE_WEATHER"),
    ],
    prompts: [
      beforePrompt("prompt-routine-2401", "you check the weather forecast", "일기예보를 확인하기"),
      afterPrompt("prompt-routine-2402", "you see rain in the forecast", "예보에서 비 소식을 보고 난"),
      beforePrompt("prompt-routine-2403", "you grab an umbrella", "우산을 챙기기"),
      whenPrompt("prompt-routine-2404", "it starts raining before you leave home", "집을 나가기 전에 비가 오기 시작할"),
      afterPrompt("prompt-routine-2405", "you put on a raincoat", "우비를 입은"),
      beforePrompt("prompt-routine-2406", "you wear a scarf on a cold morning", "추운 아침에 목도리를 두르기"),
      whilePrompt("prompt-routine-2407", "you decide what shoes to wear in wet weather,", "젖은 날씨에 어떤 신발을 신을지 고르면서"),
      afterPrompt("prompt-routine-2408", "you notice puddles outside", "밖에 물웅덩이를 본"),
      beforePrompt("prompt-routine-2409", "you leave home on a chilly evening", "쌀쌀한 저녁에 집을 나서기"),
      whenPrompt("prompt-routine-2410", "the weather changes suddenly", "날씨가 갑자기 바뀔"),
      afterPrompt("prompt-routine-2411", "you come back inside to get something for the rain", "비 때문에 뭔가 챙기러 다시 집 안으로 들어온"),
      beforePrompt("prompt-routine-2412", "you zip up your jacket", "재킷 지퍼를 올리기"),
      whilePrompt("prompt-routine-2413", "you wait by the door on a rainy morning,", "비 오는 아침 문 앞에서 잠깐 기다리면서"),
      afterPrompt("prompt-routine-2414", "you change into warmer clothes", "더 따뜻한 옷으로 갈아입은"),
      beforePrompt("prompt-routine-2415", "you step outside on a windy day", "바람이 부는 날 밖으로 나가기"),
    ],
  },
  {
    code: "shopping-stops",
    detailName: "Small Shopping Stops",
    detailOrder: 11,
    tip: "잠깐 장을 보거나 가게에 들를 때 보통 하는 행동을 순서대로 말해 보세요.",
    words: [
      word("list", "목록", "무엇을 사야 하는지 떠올리는 장면을 말할 때 좋아요.", "I make a short list before I go to the store.", "INTRO_ROUTINE_SHOPPING"),
      word("basket", "바구니", "적은 물건을 살 때 드는 도구를 자연스럽게 말할 수 있어요.", "I pick up a basket near the entrance.", "INTRO_ROUTINE_SHOPPING"),
      word("shelf", "선반, 진열대", "가게 안에서 물건을 찾는 장면을 만들기 좋아요.", "I look at the shelf for a snack.", "INTRO_ROUTINE_SHOPPING"),
      word("cashier", "계산원", "계산하는 순간을 쉽게 설명할 수 있어요.", "The cashier is busy in the evening.", "INTRO_ROUTINE_SHOPPING"),
      word("receipt", "영수증", "계산 후 마무리 행동을 말할 때 유용해요.", "I put the receipt in my bag.", "INTRO_ROUTINE_SHOPPING"),
      word("cart", "카트", "조금 더 많이 살 때 쓰는 도구를 말할 수 있어요.", "I use a cart when I need several things.", "INTRO_ROUTINE_SHOPPING"),
      word("aisle", "통로, 진열 구역", "가게 안을 둘러보는 장면을 더 구체적으로 만들어 줘요.", "I walk down the snack aisle first.", "INTRO_ROUTINE_SHOPPING"),
      word("price", "가격", "무엇을 살지 결정하는 이유를 설명하기 좋아요.", "I check the price before I choose one.", "INTRO_ROUTINE_SHOPPING"),
      word("fridge", "냉장고", "집에 돌아온 뒤 물건을 정리하는 흐름과 잘 맞아요.", "Cold food goes into the fridge first.", "INTRO_ROUTINE_SHOPPING"),
      word("bag", "가방, 쇼핑백", "산 물건을 담거나 들고 가는 장면을 말할 수 있어요.", "I carry the bag home in one hand.", "INTRO_ROUTINE_SHOPPING"),
    ],
    phrases: [
      phrase("check my list", "목록을 확인하다", "가게에 들어가기 전이나 안에서 다시 확인하는 흐름에 잘 맞아요.", "I check my list before I pick anything up.", "INTRO_ROUTINE_SHOPPING"),
      phrase("pick up a basket", "바구니를 집어 들다", "작은 장보기를 시작하는 장면을 쉽게 말할 수 있어요.", "I pick up a basket at the entrance.", "INTRO_ROUTINE_SHOPPING"),
      phrase("look at the shelves", "진열대를 보다", "무엇을 살지 고르기 전 과정을 설명하기 좋아요.", "I look at the shelves for a few seconds first.", "INTRO_ROUTINE_SHOPPING"),
      phrase("pay at the register", "계산대에서 계산하다", "가게에서의 마지막 행동을 말할 때 자연스러워요.", "I pay at the register and leave right away.", "INTRO_ROUTINE_SHOPPING"),
      phrase("put the groceries away", "장 본 것을 정리해 두다", "집에 돌아와서 마무리하는 장면과 잘 맞아요.", "I put the groceries away before I rest.", "INTRO_ROUTINE_SHOPPING"),
    ],
    prompts: [
      beforePrompt("prompt-routine-2416", "you enter a convenience store", "편의점에 들어가기"),
      afterPrompt("prompt-routine-2417", "you pick up a basket", "바구니를 집은"),
      whilePrompt("prompt-routine-2418", "you look at the shelves,", "진열대를 보면서"),
      beforePrompt("prompt-routine-2419", "you choose a snack", "간식을 고르기"),
      afterPrompt("prompt-routine-2420", "you check the price", "가격을 확인한"),
      whenPrompt("prompt-routine-2421", "you only need one or two things", "한두 가지만 필요할"),
      beforePrompt("prompt-routine-2422", "you pay at the register", "계산대에서 계산하기"),
      afterPrompt("prompt-routine-2423", "you get the receipt", "영수증을 받은"),
      whilePrompt("prompt-routine-2424", "you wait in line at the store,", "가게에서 줄을 서서 기다리면서"),
      afterPrompt("prompt-routine-2425", "you get home with groceries", "장을 보고 집에 돌아온"),
      beforePrompt("prompt-routine-2426", "you put cold food in the fridge", "차가운 음식을 냉장고에 넣기"),
      whenPrompt("prompt-routine-2427", "you stop by a store on the way home", "집에 가는 길에 가게에 잠깐 들를"),
      afterPrompt("prompt-routine-2428", "you realize you forgot one item", "한 가지를 빠뜨린 걸 알고 난"),
      beforePrompt("prompt-routine-2429", "you carry your shopping bag home", "쇼핑백을 들고 집으로 가기"),
      whenPrompt("prompt-routine-2430", "you make a short shopping list", "짧은 장보기 목록을 만들"),
    ],
  },
  {
    code: "cafe-bakery",
    detailName: "Cafe and Bakery Stops",
    detailOrder: 12,
    tip: "카페나 빵집에 잠깐 들를 때 보통 하는 행동을 부담 없이 말해 보세요.",
    words: [
      word("counter", "카운터", "주문하거나 기다리는 위치를 말할 때 자연스러워요.", "I wait near the counter for my drink.", "INTRO_ROUTINE_CAFE"),
      word("menu", "메뉴", "무엇을 고르기 전 과정을 쉽게 설명할 수 있어요.", "I read the menu before I order.", "INTRO_ROUTINE_CAFE"),
      word("tray", "쟁반", "주문한 것을 들고 자리에 가는 장면과 잘 맞아요.", "I carry the tray to a small table.", "INTRO_ROUTINE_CAFE"),
      word("cup", "컵", "마시는 동작이나 마무리 장면을 말할 때 좋아요.", "The cup feels warm in my hands.", "INTRO_ROUTINE_CAFE"),
      word("straw", "빨대", "차가운 음료를 마시는 장면을 더 구체적으로 만들어 줘요.", "I use a straw for cold drinks.", "INTRO_ROUTINE_CAFE"),
      word("pastry", "패스트리, 빵류", "빵집에서 고르는 간단한 음식을 말하기 좋아요.", "I choose one pastry with my drink.", "INTRO_ROUTINE_CAFE"),
      word("bakery", "빵집", "잠깐 들르는 장소를 아주 쉽게 설명할 수 있어요.", "The bakery smells sweet in the afternoon.", "INTRO_ROUTINE_CAFE"),
      word("napkin", "냅킨", "먹고 난 뒤 정리하는 장면을 말할 때 유용해요.", "I throw away the napkin before I leave.", "INTRO_ROUTINE_CAFE"),
      word("table", "테이블", "앉는 자리와 관련된 행동을 자연스럽게 말할 수 있어요.", "I sit at a small table by the wall.", "INTRO_ROUTINE_CAFE"),
      word("order", "주문", "가게에서 가장 중심이 되는 행동을 말할 때 좋아요.", "My order is usually simple and quick.", "INTRO_ROUTINE_CAFE"),
    ],
    phrases: [
      phrase("look at the menu", "메뉴를 보다", "무엇을 고르기 전에 하는 행동으로 아주 자연스러워요.", "I look at the menu for a moment first.", "INTRO_ROUTINE_CAFE"),
      phrase("order a drink", "음료를 주문하다", "카페에서 가장 기본적인 행동을 쉽게 말할 수 있어요.", "I order a drink before I look for a seat.", "INTRO_ROUTINE_CAFE"),
      phrase("wait for my order", "주문한 것을 기다리다", "카운터 근처에서 하는 행동과 잘 연결돼요.", "I wait for my order near the counter.", "INTRO_ROUTINE_CAFE"),
      phrase("find a seat", "자리를 찾다", "매장에서 머무는 흐름을 말할 때 자주 쓸 수 있어요.", "I find a seat near the window if I can.", "INTRO_ROUTINE_CAFE"),
      phrase("take it to go", "포장해서 가져가다", "앉지 않고 바로 나가는 상황을 설명하기 좋아요.", "I take it to go when I am in a hurry.", "INTRO_ROUTINE_CAFE"),
    ],
    prompts: [
      beforePrompt("prompt-routine-2431", "you order a drink at a cafe", "카페에서 음료를 주문하기"),
      afterPrompt("prompt-routine-2432", "you look at the menu", "메뉴를 본"),
      whilePrompt("prompt-routine-2433", "you wait for your order,", "주문한 것을 기다리면서"),
      afterPrompt("prompt-routine-2434", "you find a seat", "자리를 찾은"),
      beforePrompt("prompt-routine-2435", "you open a pastry bag", "빵 봉투를 열기"),
      whenPrompt("prompt-routine-2436", "you stop by a bakery in the afternoon", "오후에 빵집에 잠깐 들를"),
      afterPrompt("prompt-routine-2437", "you carry your tray to the table", "쟁반을 들고 테이블로 간"),
      beforePrompt("prompt-routine-2438", "you take your first sip", "첫 모금을 마시기"),
      whilePrompt("prompt-routine-2439", "you wait near the counter,", "카운터 근처에서 기다리면서"),
      afterPrompt("prompt-routine-2440", "you decide to take it to go", "포장해 가기로 정한"),
      beforePrompt("prompt-routine-2441", "you choose between two breads", "빵 두 가지 중 하나를 고르기"),
      afterPrompt("prompt-routine-2442", "you leave the cafe with your drink", "음료를 들고 카페를 나선"),
      whenPrompt("prompt-routine-2443", "you have a short stop at a bakery", "빵집에 짧게 들를"),
      beforePrompt("prompt-routine-2444", "you throw away your cup and napkin", "컵과 냅킨을 버리기"),
      afterPrompt("prompt-routine-2445", "you finish your drink at a cafe", "카페에서 음료를 다 마신"),
    ],
  },
  {
    code: "light-exercise",
    detailName: "Walking and Light Exercise",
    detailOrder: 13,
    tip: "부담 없는 산책이나 가벼운 운동을 할 때 보통 하는 행동을 말해 보세요.",
    words: [
      word("sneakers", "운동화", "가볍게 움직이기 전에 신는 신발을 말할 때 좋아요.", "I put on my sneakers before I go outside.", "INTRO_ROUTINE_EXERCISE"),
      word("mat", "운동 매트", "실내에서 짧게 움직이는 장면을 만들기 쉬워요.", "I roll out my mat in the living room.", "INTRO_ROUTINE_EXERCISE"),
      word("bottle", "물병", "움직이기 전에 챙기는 물건을 설명할 수 있어요.", "I carry a bottle when I go for a walk.", "INTRO_ROUTINE_EXERCISE"),
      word("pace", "속도", "걷거나 움직일 때의 리듬을 말할 때 자연스러워요.", "I keep a slow pace at first.", "INTRO_ROUTINE_EXERCISE"),
      word("stretch", "스트레칭", "운동 전후에 하는 가장 쉬운 행동을 말하기 좋아요.", "A short stretch helps me feel ready.", "INTRO_ROUTINE_EXERCISE"),
      word("steps", "걸음 수", "짧은 산책을 수치로 떠올릴 때 유용해요.", "I count my steps on my phone sometimes.", "INTRO_ROUTINE_EXERCISE"),
      word("park", "공원", "가볍게 몸을 움직이는 장소를 말할 때 좋아요.", "The park is good for a short walk.", "INTRO_ROUTINE_EXERCISE"),
      word("timer", "타이머", "짧은 시간만 움직일 때의 기준을 설명할 수 있어요.", "A timer helps me move for ten minutes.", "INTRO_ROUTINE_EXERCISE"),
      word("bench", "벤치", "잠깐 쉬는 장면을 더 구체적으로 만들어 줘요.", "I sit on a bench when I need a short rest.", "INTRO_ROUTINE_EXERCISE"),
      word("muscles", "근육", "몸이 풀리거나 뻐근한 느낌을 말할 때 쓸 수 있어요.", "My muscles feel better after a walk.", "INTRO_ROUTINE_EXERCISE"),
    ],
    phrases: [
      phrase("go for a walk", "산책하러 가다", "가장 기본적인 가벼운 운동 표현이라 자주 쓸 수 있어요.", "I go for a walk when I need fresh air.", "INTRO_ROUTINE_EXERCISE"),
      phrase("do a quick stretch", "간단히 스트레칭하다", "짧게 몸을 푸는 행동을 자연스럽게 말할 수 있어요.", "I do a quick stretch before I move.", "INTRO_ROUTINE_EXERCISE"),
      phrase("put on my sneakers", "운동화를 신다", "걷기 전 준비 흐름을 말하기 좋아요.", "I put on my sneakers and head outside.", "INTRO_ROUTINE_EXERCISE"),
      phrase("bring my water bottle", "물병을 챙기다", "밖으로 나가기 전 준비를 더 구체적으로 만들어 줘요.", "I bring my water bottle on warm days.", "INTRO_ROUTINE_EXERCISE"),
      phrase("cool down slowly", "천천히 몸을 식히다", "운동 후 마무리 행동을 설명할 때 잘 맞아요.", "I cool down slowly before I sit down.", "INTRO_ROUTINE_EXERCISE"),
    ],
    prompts: [
      beforePrompt("prompt-routine-2446", "you put on your sneakers", "운동화를 신기"),
      afterPrompt("prompt-routine-2447", "you start a short walk", "짧은 산책을 시작한"),
      whilePrompt("prompt-routine-2448", "you walk around your neighborhood,", "동네를 걸으면서"),
      beforePrompt("prompt-routine-2449", "you do a quick stretch", "간단히 스트레칭하기"),
      afterPrompt("prompt-routine-2450", "you finish a short workout", "짧은 운동을 마친"),
      whenPrompt("prompt-routine-2451", "you want to move a little after sitting for a long time", "오래 앉아 있다가 조금 움직이고 싶을"),
      beforePrompt("prompt-routine-2452", "you bring your water bottle outside", "물병을 챙겨 밖으로 나가기"),
      afterPrompt("prompt-routine-2453", "you sit on a bench to rest", "벤치에 잠깐 앉아 쉰"),
      whilePrompt("prompt-routine-2454", "you count your steps,", "걸음 수를 세면서"),
      beforePrompt("prompt-routine-2455", "you start moving on a lazy day", "움직이기 귀찮은 날 몸을 움직이기"),
      whenPrompt("prompt-routine-2456", "you go to a park for light exercise", "가벼운 운동을 하러 공원에 갈"),
      afterPrompt("prompt-routine-2457", "you cool down slowly", "천천히 몸을 식힌"),
      beforePrompt("prompt-routine-2458", "you roll out an exercise mat", "운동 매트를 펴기"),
      whenPrompt("prompt-routine-2459", "you only have ten minutes to move", "움직일 시간이 10분 정도밖에 없을"),
      afterPrompt("prompt-routine-2460", "you come back from a walk", "산책을 마치고 돌아온"),
    ],
  },
  {
    code: "shower-bedtime",
    detailName: "Shower and Bedtime Prep",
    detailOrder: 14,
    tip: "씻고 잠들기 전까지 이어지는 익숙한 흐름을 가볍게 말해 보세요.",
    words: [
      word("towel", "수건", "씻은 뒤 가장 먼저 쓰는 물건을 말할 때 좋아요.", "I hang up my towel after I use it.", "INTRO_ROUTINE_BEDTIME"),
      word("toothbrush", "칫솔", "잠들기 전 기본 루틴을 쉽게 설명할 수 있어요.", "My toothbrush is always near the sink.", "INTRO_ROUTINE_BEDTIME"),
      word("slippers", "슬리퍼", "욕실 안팎에서 신는 편한 신발을 말하기 좋아요.", "I put on my slippers after I dry my feet.", "INTRO_ROUTINE_BEDTIME"),
      word("shower", "샤워", "밤 루틴의 중심 행동을 간단하게 말할 수 있어요.", "A warm shower helps me feel relaxed.", "INTRO_ROUTINE_BEDTIME"),
      word("mirror", "거울", "마지막으로 얼굴을 보는 장면을 만들기 쉬워요.", "I look in the mirror before I leave the bathroom.", "INTRO_ROUTINE_BEDTIME"),
      word("pajamas", "잠옷", "잠자기 전 편한 옷으로 갈아입는 흐름과 잘 맞아요.", "I put on my pajamas after I wash up.", "INTRO_ROUTINE_BEDTIME"),
      word("soap", "비누", "씻는 장면을 더 자연스럽게 만들어 주는 기본 단어예요.", "Soap with a light scent feels nice at night.", "INTRO_ROUTINE_BEDTIME"),
      word("steam", "수증기", "욕실이 따뜻해지는 분위기를 설명할 수 있어요.", "Steam fills the bathroom after a hot shower.", "INTRO_ROUTINE_BEDTIME"),
      word("blanket", "이불", "마지막으로 침대에 들어가는 장면과 잘 이어져요.", "The blanket feels warm after a shower.", "INTRO_ROUTINE_BEDTIME"),
      word("lotion", "로션", "씻은 뒤 피부를 정리하는 행동을 말할 때 좋아요.", "I use lotion before I go to bed.", "INTRO_ROUTINE_BEDTIME"),
    ],
    phrases: [
      phrase("take a quick shower", "간단히 샤워하다", "잠들기 전 루틴을 가장 쉽게 설명할 수 있는 표현이에요.", "I take a quick shower before I change clothes.", "INTRO_ROUTINE_BEDTIME"),
      phrase("brush my teeth", "이를 닦다", "밤마다 반복하는 기본 습관을 말할 때 자연스러워요.", "I brush my teeth right before bed.", "INTRO_ROUTINE_BEDTIME"),
      phrase("put on my pajamas", "잠옷을 입다", "씻은 뒤 편하게 쉬는 흐름을 보여 주기 좋아요.", "I put on my pajamas after I dry my hair.", "INTRO_ROUTINE_BEDTIME"),
      phrase("wash up", "씻고 준비를 마치다", "여러 씻기 행동을 한꺼번에 자연스럽게 묶어 말할 수 있어요.", "I wash up and slow down for the night.", "INTRO_ROUTINE_BEDTIME"),
      phrase("turn off the bathroom light", "욕실 불을 끄다", "밤 루틴의 마무리 장면을 설명하기 좋아요.", "I turn off the bathroom light and go to my room.", "INTRO_ROUTINE_BEDTIME"),
    ],
    prompts: [
      beforePrompt("prompt-routine-2461", "you take a shower at night", "밤에 샤워하기"),
      afterPrompt("prompt-routine-2462", "you hang up your towel", "수건을 걸어 둔"),
      beforePrompt("prompt-routine-2463", "you brush your teeth", "이를 닦기"),
      afterPrompt("prompt-routine-2464", "you put on your pajamas", "잠옷을 입은"),
      whenPrompt("prompt-routine-2465", "you finish washing up", "씻는 것을 마친"),
      beforePrompt("prompt-routine-2466", "you look in the mirror one last time", "거울을 마지막으로 한 번 보기"),
      afterPrompt("prompt-routine-2467", "you turn off the bathroom light", "욕실 불을 끈"),
      whilePrompt("prompt-routine-2468", "you wait for the shower water to warm up,", "샤워 물이 따뜻해지기를 기다리면서"),
      beforePrompt("prompt-routine-2469", "you put on your slippers", "슬리퍼를 신기"),
      afterPrompt("prompt-routine-2470", "you use lotion at night", "밤에 로션을 바른"),
      whenPrompt("prompt-routine-2471", "you want to feel clean before bed", "잠들기 전에 몸을 개운하게 하고 싶을"),
      beforePrompt("prompt-routine-2472", "you fold the towel after a shower", "샤워 후 수건을 개기"),
      afterPrompt("prompt-routine-2473", "you leave the bathroom at night", "밤에 욕실에서 나온"),
      whilePrompt("prompt-routine-2474", "the bathroom gets warm and steamy,", "욕실이 따뜻하고 수증기로 가득해질 때"),
      beforePrompt("prompt-routine-2475", "you get under the blanket", "이불 속으로 들어가기"),
    ],
  },
];

const preferencePacks = [
  {
    code: "drinks-bottles",
    detailName: "Everyday Drinks and Bottles",
    detailOrder: 10,
    tip: "매일 마시기 쉬운 음료나 물병을 떠올리고 왜 좋은지 간단히 말해 보세요.",
    words: [
      word("bottle", "물병", "매일 들고 다니는 음료 용기를 말할 때 자연스러워요.", "I use one bottle almost every day.", "INTRO_PREF_DRINKS"),
      word("tumbler", "텀블러", "밖에서 마실 음료를 담는 컵을 말하기 좋아요.", "A tumbler keeps my drink cold for longer.", "INTRO_PREF_DRINKS"),
      word("refill", "다시 채우기", "물을 자주 채워 마시는 습관과 잘 맞는 단어예요.", "A bottle that is easy to refill is best for me.", "INTRO_PREF_DRINKS"),
      word("ice", "얼음", "차가운 음료 취향을 말할 때 아주 쉽게 쓸 수 있어요.", "I like a lot of ice in summer.", "INTRO_PREF_DRINKS"),
      word("lemon", "레몬", "물에 넣는 간단한 재료를 말할 때 좋아요.", "Lemon makes plain water feel fresher.", "INTRO_PREF_DRINKS"),
      word("sparkling", "탄산이 있는", "탄산수 같은 음료 취향을 설명하기 쉬워요.", "Sparkling drinks feel extra refreshing to me.", "INTRO_PREF_DRINKS"),
      word("juice", "주스", "달지 않은 가벼운 음료 취향을 말할 수 있어요.", "Juice is nice with a simple lunch.", "INTRO_PREF_DRINKS"),
      word("straw", "빨대", "마시는 방식의 취향을 구체적으로 말할 수 있어요.", "A straw makes cold drinks easier for me.", "INTRO_PREF_DRINKS"),
      word("lid", "뚜껑", "텀블러나 병의 편한 점을 설명할 때 좋아요.", "A good lid keeps the drink from spilling.", "INTRO_PREF_DRINKS"),
      word("sip", "조금씩 마시다", "한 번에 많이 마시지 않는 습관을 말할 수 있어요.", "I sip my drink slowly while I work.", "INTRO_PREF_DRINKS"),
    ],
    phrases: [
      phrase("easy to carry around", "들고 다니기 쉽다", "물병이나 컵을 좋아하는 이유를 가장 쉽게 말할 수 있어요.", "It is easy to carry around all day.", "INTRO_PREF_DRINKS"),
      phrase("keeps my drink cold", "음료를 차갑게 유지해 준다", "텀블러나 병의 장점을 구체적으로 설명하기 좋아요.", "It keeps my drink cold for a long time.", "INTRO_PREF_DRINKS"),
      phrase("not too sweet", "너무 달지 않다", "음료 맛 취향을 아주 자연스럽게 말할 수 있어요.", "It is not too sweet, so I never get tired of it.", "INTRO_PREF_DRINKS"),
      phrase("easy to refill", "다시 채우기 쉽다", "자주 마시는 물병이나 컵을 설명할 때 잘 맞아요.", "It is easy to refill at school or work.", "INTRO_PREF_DRINKS"),
      phrase("good with ice", "얼음과 잘 어울린다", "차가운 음료를 좋아하는 이유를 붙이기 좋아요.", "It is good with ice on a hot day.", "INTRO_PREF_DRINKS"),
    ],
    prompts: [
      favoritePrompt("prompt-preference-2501", "water bottle size", "물병 크기"),
      favoritePrompt("prompt-preference-2502", "tumbler lid style", "텀블러 뚜껑 스타일"),
      favoritePrompt("prompt-preference-2503", "sparkling water flavor", "탄산수 맛"),
      favoritePrompt("prompt-preference-2504", "drink to carry on a walk", "산책할 때 들고 가기 좋은 음료"),
      favoritePrompt("prompt-preference-2505", "juice flavor with lunch", "점심과 함께 마시기 좋은 주스 맛"),
      favoritePrompt("prompt-preference-2506", "fruit to add to water", "물에 넣기 좋은 과일"),
      favoritePrompt("prompt-preference-2507", "bottle color for daily use", "매일 쓰기 좋은 물병 색"),
      favoritePrompt("prompt-preference-2508", "straw type for cold drinks", "차가운 음료에 쓰기 좋은 빨대 종류"),
      favoritePrompt("prompt-preference-2509", "drink to keep cold in summer", "여름에 차갑게 두고 마시기 좋은 음료"),
      favoritePrompt("prompt-preference-2510", "drink to sip during study time", "공부할 때 조금씩 마시기 좋은 음료"),
      favoritePrompt("prompt-preference-2511", "reusable cup to take outside", "밖에 들고 나가기 좋은 다회용 컵"),
      favoritePrompt("prompt-preference-2512", "drink after light exercise", "가벼운 운동 뒤에 마시기 좋은 음료"),
      favoritePrompt("prompt-preference-2513", "ice level in a cold drink", "차가운 음료에 넣는 얼음 양"),
      favoritePrompt("prompt-preference-2514", "bottle shape to hold", "손에 쥐기 좋은 물병 모양"),
      favoritePrompt("prompt-preference-2515", "simple drink when you feel thirsty", "목이 마를 때 마시기 좋은 간단한 음료"),
    ],
  },
  {
    code: "bags-carry",
    detailName: "Bags and Daily Carry Items",
    detailOrder: 11,
    tip: "매일 들고 다니는 가방이나 작은 소지품을 떠올리고 왜 좋은지 말해 보세요.",
    words: [
      word("backpack", "백팩", "매일 메고 다니는 가방을 말할 때 자연스러워요.", "A backpack is easy for school or work.", "INTRO_PREF_CARRY"),
      word("tote", "토트백", "가볍게 들고 나가는 가방을 설명하기 좋아요.", "I use a tote for short trips outside.", "INTRO_PREF_CARRY"),
      word("pouch", "파우치", "가방 안 작은 물건을 정리하는 데 쓰는 용품을 말할 수 있어요.", "A pouch keeps my small things together.", "INTRO_PREF_CARRY"),
      word("wallet", "지갑", "매일 쓰는 작은 소지품 취향을 쉽게 설명할 수 있어요.", "My wallet is slim and easy to carry.", "INTRO_PREF_CARRY"),
      word("keychain", "열쇠고리", "자주 보는 작은 물건의 취향을 말하기 좋아요.", "A keychain helps me find my keys quickly.", "INTRO_PREF_CARRY"),
      word("strap", "끈, 스트랩", "가방 길이나 편한 착용감을 설명할 수 있어요.", "A soft strap feels better on my shoulder.", "INTRO_PREF_CARRY"),
      word("zipper", "지퍼", "가방을 여닫는 방식의 편한 점을 말할 때 좋아요.", "A zipper makes me feel my things are safe.", "INTRO_PREF_CARRY"),
      word("pocket", "주머니, 수납칸", "물건을 쉽게 찾는 이유를 설명할 수 있어요.", "A front pocket is useful for my card case.", "INTRO_PREF_CARRY"),
      word("cardholder", "카드지갑", "작은 카드용 소지품을 말할 때 자연스러워요.", "A cardholder is enough for short outings.", "INTRO_PREF_CARRY"),
      word("charger", "충전기", "가방에 넣고 다니는 실용적인 물건을 말할 수 있어요.", "I always keep a charger in my bag.", "INTRO_PREF_CARRY"),
    ],
    phrases: [
      phrase("easy to carry", "들고 다니기 쉽다", "가방이나 소지품을 좋아하는 이유를 가장 쉽게 말할 수 있어요.", "It is easy to carry every day.", "INTRO_PREF_CARRY"),
      phrase("fits everything I need", "필요한 것이 다 들어간다", "가방 크기와 실용성을 함께 설명하기 좋아요.", "It fits everything I need for the day.", "INTRO_PREF_CARRY"),
      phrase("easy to find inside", "안에서 찾기 쉽다", "수납칸이나 파우치의 장점을 말할 때 잘 맞아요.", "It is easy to find inside, even in a hurry.", "INTRO_PREF_CARRY"),
      phrase("light on my shoulder", "어깨에 부담이 적다", "메는 가방의 편한 점을 자연스럽게 설명할 수 있어요.", "It feels light on my shoulder all day.", "INTRO_PREF_CARRY"),
      phrase("has useful pockets", "쓸모 있는 주머니가 있다", "가방 구조의 장점을 구체적으로 말하기 좋아요.", "It has useful pockets for small items.", "INTRO_PREF_CARRY"),
    ],
    prompts: [
      favoritePrompt("prompt-preference-2516", "backpack for daily use", "매일 쓰기 좋은 백팩"),
      favoritePrompt("prompt-preference-2517", "tote bag for a short trip", "짧게 나갈 때 들기 좋은 토트백"),
      favoritePrompt("prompt-preference-2518", "small pouch in your bag", "가방 안 작은 파우치"),
      favoritePrompt("prompt-preference-2519", "wallet size", "지갑 크기"),
      favoritePrompt("prompt-preference-2520", "keychain to use every day", "매일 쓰기 좋은 열쇠고리"),
      favoritePrompt("prompt-preference-2521", "bag pocket", "가방 수납칸"),
      favoritePrompt("prompt-preference-2522", "zipper style on a bag", "가방 지퍼 스타일"),
      favoritePrompt("prompt-preference-2523", "cardholder", "카드지갑"),
      favoritePrompt("prompt-preference-2524", "strap length on a bag", "가방 끈 길이"),
      favoritePrompt("prompt-preference-2525", "bag color for everyday use", "매일 쓰기 좋은 가방 색"),
      favoritePrompt("prompt-preference-2526", "little thing to keep in your bag", "가방에 넣어 두기 좋은 작은 물건"),
      favoritePrompt("prompt-preference-2527", "portable charger to carry", "들고 다니기 좋은 휴대용 충전기"),
      favoritePrompt("prompt-preference-2528", "pouch for pens or cables", "펜이나 케이블을 넣기 좋은 파우치"),
      favoritePrompt("prompt-preference-2529", "bag to use on rainy days", "비 오는 날 쓰기 좋은 가방"),
      favoritePrompt("prompt-preference-2530", "small bag for a quick trip outside", "잠깐 나갈 때 쓰기 좋은 작은 가방"),
    ],
  },
  {
    code: "organizing-helpers",
    detailName: "Cleaning and Organizing Helpers",
    detailOrder: 12,
    tip: "정리나 청소를 더 쉽게 해 주는 물건을 떠올리고 왜 좋은지 말해 보세요.",
    words: [
      word("shelf", "선반", "작은 물건을 정리해 두는 장소를 말할 때 자연스러워요.", "A shelf keeps my things off the desk.", "INTRO_PREF_ORG"),
      word("drawer", "서랍", "숨겨 두고 정리하는 공간을 설명하기 좋아요.", "I keep small things in a drawer.", "INTRO_PREF_ORG"),
      word("hanger", "옷걸이", "옷을 정리하는 도구의 편한 점을 말할 수 있어요.", "A good hanger keeps clothes in shape.", "INTRO_PREF_ORG"),
      word("basket", "바구니", "수건이나 작은 물건을 담는 용품을 쉽게 설명할 수 있어요.", "A basket keeps the room looking neat.", "INTRO_PREF_ORG"),
      word("label", "라벨", "무엇이 들어 있는지 한눈에 알 수 있는 이유를 붙이기 좋아요.", "A label helps me find things faster.", "INTRO_PREF_ORG"),
      word("hook", "고리", "문 옆이나 벽에 걸어 두는 정리용품을 말할 수 있어요.", "A hook is useful for bags and keys.", "INTRO_PREF_ORG"),
      word("cloth", "천, 걸레", "닦는 도구를 부드럽게 설명할 때 자연스러워요.", "A soft cloth is enough for quick cleaning.", "INTRO_PREF_ORG"),
      word("spray", "스프레이", "쉽게 뿌리고 닦는 청소용품을 말할 때 좋아요.", "A spray bottle makes cleaning faster.", "INTRO_PREF_ORG"),
      word("sponge", "스펀지", "부엌이나 싱크대를 닦는 도구를 말할 수 있어요.", "A sponge is easy to use in the kitchen.", "INTRO_PREF_ORG"),
      word("box", "상자", "작은 물건을 모아 두는 보관용품을 설명하기 좋아요.", "A box keeps cables in one place.", "INTRO_PREF_ORG"),
    ],
    phrases: [
      phrase("keeps things in place", "물건을 제자리에 있게 해 준다", "정리 도구를 좋아하는 이유를 아주 쉽게 말할 수 있어요.", "It keeps things in place and looks tidy.", "INTRO_PREF_ORG"),
      phrase("easy to wipe clean", "닦기 쉽다", "청소용품이나 표면 도구의 장점을 설명하기 좋아요.", "It is easy to wipe clean after I use it.", "INTRO_PREF_ORG"),
      phrase("saves me time", "시간을 아껴 준다", "정리나 청소가 빨라지는 이유를 붙이기 좋아요.", "It saves me time every morning.", "INTRO_PREF_ORG"),
      phrase("makes my room look neater", "방이 더 정돈돼 보이게 한다", "정리 도구의 효과를 자연스럽게 말할 수 있어요.", "It makes my room look neater right away.", "INTRO_PREF_ORG"),
      phrase("easy to put away", "정리해 두기 쉽다", "자주 쓰는 도구를 편하게 치우는 장점을 설명할 수 있어요.", "It is easy to put away after use.", "INTRO_PREF_ORG"),
    ],
    prompts: [
      favoritePrompt("prompt-preference-2531", "storage basket at home", "집에서 쓰는 수납 바구니"),
      favoritePrompt("prompt-preference-2532", "hanger type for daily clothes", "매일 입는 옷에 쓰기 좋은 옷걸이 종류"),
      favoritePrompt("prompt-preference-2533", "drawer organizer", "서랍 정리함"),
      favoritePrompt("prompt-preference-2534", "wall hook to use at home", "집에서 쓰기 좋은 벽걸이 고리"),
      favoritePrompt("prompt-preference-2535", "box for small items", "작은 물건을 넣어 두기 좋은 상자"),
      favoritePrompt("prompt-preference-2536", "cleaning cloth for your desk", "책상을 닦기 좋은 천"),
      favoritePrompt("prompt-preference-2537", "spray bottle for easy cleaning", "가볍게 청소하기 좋은 스프레이 병"),
      favoritePrompt("prompt-preference-2538", "sponge for the kitchen", "부엌에서 쓰기 좋은 스펀지"),
      favoritePrompt("prompt-preference-2539", "small shelf in your room", "방 안 작은 선반"),
      favoritePrompt("prompt-preference-2540", "label style for organizing", "정리할 때 쓰기 좋은 라벨 스타일"),
      favoritePrompt("prompt-preference-2541", "organizer for a bathroom drawer", "욕실 서랍 정리함"),
      favoritePrompt("prompt-preference-2542", "shoe box to reuse at home", "집에서 다시 쓰기 좋은 신발 상자"),
      favoritePrompt("prompt-preference-2543", "box to keep cables in", "케이블을 넣어 두기 좋은 상자"),
      favoritePrompt("prompt-preference-2544", "basket to hold towels", "수건을 담아 두기 좋은 바구니"),
      favoritePrompt("prompt-preference-2545", "hook near the door for bags or keys", "문 근처에서 가방이나 열쇠를 걸어 두기 좋은 고리"),
    ],
  },
  {
    code: "home-gadgets",
    detailName: "Home Devices and Small Gadgets",
    detailOrder: 13,
    tip: "집에서 자주 쓰는 작은 기기나 도구를 떠올리고 왜 편한지 말해 보세요.",
    words: [
      word("charger", "충전기", "매일 쓰는 기본 기기를 설명할 때 자연스러워요.", "A charger near my bed is very useful.", "INTRO_PREF_GADGET"),
      word("cable", "케이블", "길이나 쓰기 편한 점을 말할 때 좋아요.", "A long cable is easier for me to use.", "INTRO_PREF_GADGET"),
      word("speaker", "스피커", "배경 음악을 들을 때 쓰는 기기를 설명할 수 있어요.", "A small speaker is enough for my room.", "INTRO_PREF_GADGET"),
      word("fan", "선풍기", "작은 방에서 쓰는 시원한 기기를 말하기 좋아요.", "A fan is a must on warm nights.", "INTRO_PREF_GADGET"),
      word("clock", "시계", "시간을 확인하거나 알람을 맞추는 기기를 설명할 수 있어요.", "I like a clock that is easy to read.", "INTRO_PREF_GADGET"),
      word("stand", "거치대", "휴대폰이나 태블릿을 세워 두는 도구를 말할 수 있어요.", "A stand keeps my phone at the right height.", "INTRO_PREF_GADGET"),
      word("lamp", "램프, 조명", "밤에 쓰는 작은 조명을 쉽게 설명할 수 있어요.", "A warm lamp makes my room feel calm.", "INTRO_PREF_GADGET"),
      word("timer", "타이머", "짧은 시간을 재는 기기를 말할 때 좋아요.", "A timer helps me stay on track.", "INTRO_PREF_GADGET"),
      word("humidifier", "가습기", "방이 건조할 때 쓰는 기기를 설명할 수 있어요.", "A humidifier is helpful in winter.", "INTRO_PREF_GADGET"),
      word("strip", "멀티탭", "여러 기기를 연결하는 도구를 말할 때 유용해요.", "A power strip keeps my desk simple.", "INTRO_PREF_GADGET"),
    ],
    phrases: [
      phrase("easy to use", "사용하기 쉽다", "작은 기기를 좋아하는 이유를 가장 쉽게 말할 수 있어요.", "It is easy to use even when I am tired.", "INTRO_PREF_GADGET"),
      phrase("does the job well", "제 역할을 잘한다", "복잡하지 않지만 충분히 좋다는 느낌을 설명하기 좋아요.", "It does the job well and never feels complicated.", "INTRO_PREF_GADGET"),
      phrase("easy to move around", "옮기기 쉽다", "방 안 여기저기 두고 쓰는 기기를 말할 때 자연스러워요.", "It is easy to move around when I clean.", "INTRO_PREF_GADGET"),
      phrase("fits in a small space", "작은 공간에 잘 들어간다", "방이 크지 않을 때 좋은 기기의 장점을 설명할 수 있어요.", "It fits in a small space on my desk.", "INTRO_PREF_GADGET"),
      phrase("helps every day", "매일 도움을 준다", "자주 쓰는 생활 기기의 가치를 자연스럽게 말할 수 있어요.", "It helps every day without any trouble.", "INTRO_PREF_GADGET"),
    ],
    prompts: [
      favoritePrompt("prompt-preference-2546", "phone charger at home", "집에서 쓰는 휴대폰 충전기"),
      favoritePrompt("prompt-preference-2547", "cable length for daily use", "매일 쓰기 좋은 케이블 길이"),
      favoritePrompt("prompt-preference-2548", "small speaker for background music", "배경 음악용 작은 스피커"),
      favoritePrompt("prompt-preference-2549", "desk fan for warm days", "더운 날 쓰기 좋은 책상용 선풍기"),
      favoritePrompt("prompt-preference-2550", "alarm clock style", "알람 시계 스타일"),
      favoritePrompt("prompt-preference-2551", "phone stand on your desk", "책상 위 휴대폰 거치대"),
      favoritePrompt("prompt-preference-2552", "bedside lamp", "침대 옆 조명"),
      favoritePrompt("prompt-preference-2553", "timer for short tasks", "짧은 일을 할 때 쓰기 좋은 타이머"),
      favoritePrompt("prompt-preference-2554", "compact humidifier", "작은 가습기"),
      favoritePrompt("prompt-preference-2555", "power strip at home", "집에서 쓰는 멀티탭"),
      favoritePrompt("prompt-preference-2556", "little light for reading at night", "밤에 읽을 때 쓰기 좋은 작은 조명"),
      favoritePrompt("prompt-preference-2557", "charger to keep by your bed", "침대 옆에 두기 좋은 충전기"),
      favoritePrompt("prompt-preference-2558", "fan size for your room", "방에 두기 좋은 선풍기 크기"),
      favoritePrompt("prompt-preference-2559", "stand to hold your tablet", "태블릿을 올려 두기 좋은 거치대"),
      favoritePrompt("prompt-preference-2560", "clip-on lamp for a desk or bed", "책상이나 침대에 끼워 쓰기 좋은 집게 조명"),
    ],
  },
  {
    code: "kitchen-helpers",
    detailName: "Kitchen Helpers and Food Storage",
    detailOrder: 14,
    tip: "부엌에서 자주 쓰는 작은 도구나 보관 용기를 떠올리고 왜 좋은지 말해 보세요.",
    words: [
      word("container", "보관 용기", "남은 음식을 담아 두는 물건을 설명할 때 좋아요.", "A container is useful for leftovers.", "INTRO_PREF_KITCHEN"),
      word("lid", "뚜껑", "용기의 편한 점을 말할 때 자연스럽게 쓸 수 있어요.", "A good lid closes tightly.", "INTRO_PREF_KITCHEN"),
      word("kettle", "주전자", "물을 데우는 도구를 쉽게 설명할 수 있어요.", "A small kettle is enough for my kitchen.", "INTRO_PREF_KITCHEN"),
      word("tray", "트레이", "간식이나 컵을 올려 두는 도구를 말하기 좋아요.", "A tray makes snacks look neat.", "INTRO_PREF_KITCHEN"),
      word("spoon", "숟가락", "수프나 요거트를 먹을 때 쓰는 도구를 설명할 수 있어요.", "I like a spoon that feels light in my hand.", "INTRO_PREF_KITCHEN"),
      word("chopsticks", "젓가락", "집에서 매일 쓰는 식사 도구를 쉽게 말할 수 있어요.", "Good chopsticks are easy to hold.", "INTRO_PREF_KITCHEN"),
      word("board", "도마", "간단한 재료를 자를 때 쓰는 도구를 말할 수 있어요.", "A small board is easy to wash and dry.", "INTRO_PREF_KITCHEN"),
      word("towel", "행주, 주방 수건", "부엌에서 닦거나 정리할 때 쓰는 천을 설명할 수 있어요.", "A kitchen towel helps me clean up fast.", "INTRO_PREF_KITCHEN"),
      word("thermos", "보온병", "따뜻한 음료를 담아 두는 용기를 말할 때 좋아요.", "A thermos keeps my drink warm for hours.", "INTRO_PREF_KITCHEN"),
      word("freezer", "냉동실", "얼리거나 오래 보관하는 흐름과 잘 맞는 단어예요.", "The freezer is useful for quick meals.", "INTRO_PREF_KITCHEN"),
    ],
    phrases: [
      phrase("easy to wash", "씻기 쉽다", "주방 도구를 좋아하는 이유를 가장 쉽게 말할 수 있어요.", "It is easy to wash after I use it.", "INTRO_PREF_KITCHEN"),
      phrase("easy to store", "보관하기 쉽다", "작은 부엌이나 제한된 공간에 잘 맞는 이유를 설명할 수 있어요.", "It is easy to store in a small kitchen.", "INTRO_PREF_KITCHEN"),
      phrase("good for leftovers", "남은 음식을 담기에 좋다", "용기나 보관 도구의 장점을 자연스럽게 말할 수 있어요.", "It is good for leftovers after dinner.", "INTRO_PREF_KITCHEN"),
      phrase("easy to hold", "잡기 쉽다", "숟가락이나 젓가락 같은 도구의 편한 점을 설명하기 좋아요.", "It is easy to hold and feels light.", "INTRO_PREF_KITCHEN"),
      phrase("fits in the fridge", "냉장고에 잘 들어간다", "보관 용기의 실용성을 구체적으로 말할 수 있어요.", "It fits in the fridge without taking much space.", "INTRO_PREF_KITCHEN"),
    ],
    prompts: [
      favoritePrompt("prompt-preference-2561", "food container for leftovers", "남은 음식을 담아 두기 좋은 보관 용기"),
      favoritePrompt("prompt-preference-2562", "lid type on a food container", "보관 용기 뚜껑 종류"),
      favoritePrompt("prompt-preference-2563", "lunch bag to carry", "들고 다니기 좋은 점심 가방"),
      favoritePrompt("prompt-preference-2564", "spoon to use for soup", "수프 먹을 때 쓰기 좋은 숟가락"),
      favoritePrompt("prompt-preference-2565", "chopsticks to use at home", "집에서 쓰기 좋은 젓가락"),
      favoritePrompt("prompt-preference-2566", "small tray for snacks", "간식 올려 두기 좋은 작은 트레이"),
      favoritePrompt("prompt-preference-2567", "cutting board size", "도마 크기"),
      favoritePrompt("prompt-preference-2568", "kitchen towel", "주방 수건"),
      favoritePrompt("prompt-preference-2569", "kettle at home", "집에서 쓰는 주전자"),
      favoritePrompt("prompt-preference-2570", "thermos for a warm drink", "따뜻한 음료를 담기 좋은 보온병"),
      favoritePrompt("prompt-preference-2571", "container to keep fruit in", "과일을 넣어 두기 좋은 용기"),
      favoritePrompt("prompt-preference-2572", "freezer box for small foods", "작은 음식을 얼려 두기 좋은 냉동 용기"),
      favoritePrompt("prompt-preference-2573", "lunch box to use on a busy day", "바쁜 날 쓰기 좋은 도시락통"),
      favoritePrompt("prompt-preference-2574", "thermos to take outside", "밖에 들고 나가기 좋은 보온병"),
      favoritePrompt("prompt-preference-2575", "little container for sauce or snacks", "소스나 작은 간식을 담기 좋은 작은 용기"),
    ],
  },
];

const allPacks = [
  ...routinePacks.map((pack) => ({
    ...pack,
    family: "routine",
    categoryVar: "@intro_routine_category_id",
  })),
  ...preferencePacks.map((pack) => ({
    ...pack,
    family: "preference",
    categoryVar: "@intro_preference_category_id",
  })),
];

function buildHintRows(prompt, words, phrases) {
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
    isRoutine ? "보통 ...한다" : "가장 좋아하는 것은 ...이고, 이유는 ...이다",
    isRoutine
      ? "바로 다음에 이어질 일상 행동을 하나나 두 개 정도 자연스럽게 붙여 보세요."
      : "좋아하는 대상을 먼저 말하고, 간단한 이유를 한 문장으로 이어 보세요.",
    isRoutine
      ? "I usually do one or two small things that fit my normal routine."
      : "My favorite one is simple and familiar because it suits me well.",
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
  lines.push("-- Seed 150 more intro prompts with full hint metadata.");
  lines.push("-- Generated by tools/prompt-seed/generate_intro_prompt_migration_batch2.mjs");
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

  let displayOrder = 7001;

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
      lines.push(...buildHintRows(prompt, pack.words, pack.phrases));
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
if (generatedCount !== 150) {
  throw new Error(`Expected 150 generated intro prompts, found ${generatedCount}.`);
}

const sqlText = generateSql();
fs.mkdirSync(path.dirname(OUTPUT_SQL), { recursive: true });
fs.writeFileSync(OUTPUT_SQL, sqlText, "utf8");

console.log(`Generated ${generatedCount} intro prompts into ${OUTPUT_SQL}`);
