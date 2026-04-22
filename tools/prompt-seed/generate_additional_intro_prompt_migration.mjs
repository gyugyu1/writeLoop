import fs from "fs";
import path from "path";

const OUTPUT_SQL = path.join("infra", "mysql", "schema", "056-seed-additional-intro-prompts.sql");

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

function beforePrompt(id, clauseEn, clauseKo, starterEn) {
  return promptSpec(
    id,
    `What do you usually do before ${clauseEn}?`,
    `${clauseKo} 보통 무엇을 하나요?`,
    `Before ${starterEn}, I usually ...`
  );
}

function afterPrompt(id, clauseEn, clauseKo, starterEn) {
  return promptSpec(
    id,
    `What do you usually do after ${clauseEn}?`,
    `${clauseKo} 보통 무엇을 하나요?`,
    `After ${starterEn}, I usually ...`
  );
}

function whenPrompt(id, clauseEn, clauseKo, starterEn) {
  return promptSpec(
    id,
    `When ${clauseEn}, what do you usually do?`,
    `${clauseKo} 보통 무엇을 하나요?`,
    `When ${starterEn}, I usually ...`
  );
}

function whilePrompt(id, clauseEn, clauseKo, starterEn) {
  return promptSpec(
    id,
    `While ${clauseEn}, what do you usually do?`,
    `${clauseKo} 보통 무엇을 하나요?`,
    `While ${starterEn}, I usually ...`
  );
}

function favoritePrompt(id, subjectEn, subjectKo, starterSubjectEn = subjectEn) {
  return promptSpec(
    id,
    `What is your favorite ${subjectEn}, and why do you like it?`,
    `${subjectKo} 중에서 가장 좋아하는 것은 무엇이고, 왜 좋아하나요?`,
    `My favorite ${starterSubjectEn} is ... because ...`
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
    tip: "날씨에 맞춰 챙기는 물건이나 행동을 순서대로 말해 보세요.",
    words: [
      word("forecast", "예보", "날씨를 먼저 확인하는 습관을 말할 때 좋아요.", "I check the forecast before I leave home.", "INTRO_ROUTINE_WEATHER"),
      word("umbrella", "우산", "비 오는 날 챙기는 물건으로 아주 자주 써요.", "I keep a small umbrella in my bag.", "INTRO_ROUTINE_WEATHER"),
      word("jacket", "재킷", "쌀쌀할 때 입는 옷을 말할 때 자연스러워요.", "I wear a light jacket on cool days.", "INTRO_ROUTINE_WEATHER"),
      word("scarf", "목도리", "추운 날 준비하는 물건을 말할 때 좋아요.", "A scarf keeps my neck warm in the morning.", "INTRO_ROUTINE_WEATHER"),
      word("raincoat", "우비", "비가 많이 올 때 입는 옷을 말할 때 좋아요.", "I wear a raincoat on very wet days.", "INTRO_ROUTINE_WEATHER"),
      word("boots", "부츠", "젖은 날 신는 신발을 말할 때 유용해요.", "Boots help me walk through puddles.", "INTRO_ROUTINE_WEATHER"),
      word("chilly", "쌀쌀한", "날씨 느낌을 간단하게 설명할 때 좋아요.", "The evening feels chilly today.", "INTRO_ROUTINE_WEATHER"),
      word("puddle", "물웅덩이", "비 온 뒤 바닥 상태를 말할 때 좋아요.", "I try not to step in a puddle.", "INTRO_ROUTINE_WEATHER"),
      word("hoodie", "후드티", "가볍게 걸치는 옷을 말할 때 자연스러워요.", "A hoodie is easy to wear on windy days.", "INTRO_ROUTINE_WEATHER"),
      word("weather", "날씨", "전체 상황을 가장 쉽게 말할 수 있는 기본 단어예요.", "The weather changes quickly in spring.", "INTRO_ROUTINE_WEATHER"),
    ],
    phrases: [
      phrase("check the forecast", "일기예보를 확인하다", "집을 나가기 전 행동으로 자주 써요.", "I check the forecast every morning.", "INTRO_ROUTINE_WEATHER"),
      phrase("grab an umbrella", "우산을 챙기다", "급하게 준비하는 느낌을 주기에 좋아요.", "I grab an umbrella before I head out.", "INTRO_ROUTINE_WEATHER"),
      phrase("put on a jacket", "재킷을 입다", "날씨에 맞춰 옷을 입는 말을 할 때 좋아요.", "I put on a jacket when the air feels cold.", "INTRO_ROUTINE_WEATHER"),
      phrase("wear waterproof shoes", "방수 신발을 신다", "비 오는 날 준비를 구체적으로 말할 수 있어요.", "I wear waterproof shoes on rainy days.", "INTRO_ROUTINE_WEATHER"),
      phrase("leave a little early", "조금 일찍 나가다", "비나 바람 때문에 서두를 때 잘 어울려요.", "I leave a little early when the weather is bad.", "INTRO_ROUTINE_WEATHER"),
    ],
    prompts: [
      beforePrompt("prompt-routine-2401", "you check the weather forecast", "일기예보를 확인하기 전에", "I check the weather forecast"),
      afterPrompt("prompt-routine-2402", "you see rain in the forecast", "예보에서 비 소식을 보고 난 뒤에", "I see rain in the forecast"),
      beforePrompt("prompt-routine-2403", "you grab an umbrella", "우산을 챙기기 전에", "I grab an umbrella"),
      whenPrompt("prompt-routine-2404", "it starts raining before you leave", "나가기 전에 비가 오기 시작할 때", "it starts raining before I leave"),
      afterPrompt("prompt-routine-2405", "you put on a raincoat", "우비를 입은 뒤에", "I put on a raincoat"),
      beforePrompt("prompt-routine-2406", "you wear a scarf on a cold morning", "추운 아침에 목도리를 두르기 전에", "I wear a scarf on a cold morning"),
      whilePrompt("prompt-routine-2407", "you decide what shoes to wear in wet weather", "젖은 날씨에 어떤 신발을 신을지 고르면서", "I decide what shoes to wear in wet weather"),
      afterPrompt("prompt-routine-2408", "you notice puddles outside", "밖에 물웅덩이를 보고 난 뒤에", "I notice puddles outside"),
      beforePrompt("prompt-routine-2409", "you leave home on a chilly evening", "쌀쌀한 저녁에 집을 나서기 전에", "I leave home on a chilly evening"),
      whenPrompt("prompt-routine-2410", "the weather changes suddenly", "날씨가 갑자기 바뀔 때", "the weather changes suddenly"),
      afterPrompt("prompt-routine-2411", "you go back inside to grab an umbrella", "우산을 챙기려고 다시 집 안으로 들어온 뒤에", "I go back inside to grab an umbrella"),
      beforePrompt("prompt-routine-2412", "you zip up your jacket", "재킷 지퍼를 올리기 전에", "I zip up my jacket"),
      whilePrompt("prompt-routine-2413", "you wait by the door on a rainy morning", "비 오는 아침 문 앞에서 잠깐 기다리면서", "I wait by the door on a rainy morning"),
      afterPrompt("prompt-routine-2414", "you change into warmer clothes", "더 따뜻한 옷으로 갈아입은 뒤에", "I change into warmer clothes"),
      beforePrompt("prompt-routine-2415", "you step outside on a windy day", "바람이 부는 날 밖으로 나가기 전에", "I step outside on a windy day"),
    ],
  },
  {
    code: "small-shopping-stops",
    detailName: "Small Errands and Convenience Stops",
    detailOrder: 11,
    tip: "가게에 잠깐 들렀을 때 하는 행동을 차례대로 말해 보세요.",
    words: [
      word("list", "목록", "무엇을 사야 하는지 정리할 때 좋아요.", "I make a short list before shopping.", "INTRO_ROUTINE_SHOPPING"),
      word("basket", "바구니", "작게 장볼 때 바로 떠올리기 쉬운 단어예요.", "I pick up a basket at the door.", "INTRO_ROUTINE_SHOPPING"),
      word("shelf", "진열대", "상품을 고르는 장소를 말할 때 좋아요.", "I look at the shelf for snacks.", "INTRO_ROUTINE_SHOPPING"),
      word("cashier", "계산대 직원", "계산할 때 만나는 사람을 말할 수 있어요.", "The cashier smiles and says hello.", "INTRO_ROUTINE_SHOPPING"),
      word("receipt", "영수증", "계산 뒤에 받는 것을 말할 때 써요.", "I keep the receipt in my bag.", "INTRO_ROUTINE_SHOPPING"),
      word("cart", "카트", "물건이 많을 때 쓰는 도구를 말할 때 좋아요.", "I use a cart when I buy many things.", "INTRO_ROUTINE_SHOPPING"),
      word("aisle", "통로", "가게 안에서 움직이는 곳을 말할 때 좋아요.", "I walk down the drink aisle first.", "INTRO_ROUTINE_SHOPPING"),
      word("price", "가격", "사는 이유를 설명할 때 자주 써요.", "I check the price before I decide.", "INTRO_ROUTINE_SHOPPING"),
      word("fridge", "냉장고", "집에 와서 음식을 정리할 때 자주 나와요.", "Cold food goes into the fridge first.", "INTRO_ROUTINE_SHOPPING"),
      word("bag", "봉투, 가방", "계산 후 들고 가는 것을 말할 때 좋아요.", "I carry one shopping bag home.", "INTRO_ROUTINE_SHOPPING"),
    ],
    phrases: [
      phrase("check my list", "목록을 확인하다", "무언가를 빠뜨리지 않으려 할 때 자연스러워요.", "I check my list before I buy anything.", "INTRO_ROUTINE_SHOPPING"),
      phrase("pick up a basket", "바구니를 집다", "가게에 들어가서 바로 하는 행동으로 좋아요.", "I pick up a basket near the entrance.", "INTRO_ROUTINE_SHOPPING"),
      phrase("look at the shelves", "진열대를 보다", "무엇을 고르는지 말할 때 자주 써요.", "I look at the shelves for a simple snack.", "INTRO_ROUTINE_SHOPPING"),
      phrase("pay at the register", "계산대에서 계산하다", "장보기 흐름의 마무리를 말할 때 좋아요.", "I pay at the register and leave quickly.", "INTRO_ROUTINE_SHOPPING"),
      phrase("put the groceries away", "사 온 물건을 정리하다", "집에 돌아온 뒤 행동을 말할 때 좋아요.", "I put the groceries away right after I get home.", "INTRO_ROUTINE_SHOPPING"),
    ],
    prompts: [
      beforePrompt("prompt-routine-2416", "you enter a convenience store", "편의점에 들어가기 전에", "I enter a convenience store"),
      afterPrompt("prompt-routine-2417", "you pick up a basket", "바구니를 집은 뒤에", "I pick up a basket"),
      whilePrompt("prompt-routine-2418", "you look at the shelves", "진열대를 보면서", "I look at the shelves"),
      beforePrompt("prompt-routine-2419", "you choose a snack", "간식을 고르기 전에", "I choose a snack"),
      afterPrompt("prompt-routine-2420", "you check the price", "가격을 확인한 뒤에", "I check the price"),
      whenPrompt("prompt-routine-2421", "you only need one or two things", "한두 가지만 필요할 때", "I only need one or two things"),
      beforePrompt("prompt-routine-2422", "you pay at the register", "계산대에서 계산하기 전에", "I pay at the register"),
      afterPrompt("prompt-routine-2423", "you get the receipt", "영수증을 받은 뒤에", "I get the receipt"),
      whilePrompt("prompt-routine-2424", "you wait in line at the store", "가게에서 줄을 서서 기다리면서", "I wait in line at the store"),
      afterPrompt("prompt-routine-2425", "you get home with groceries", "장을 보고 집에 돌아온 뒤에", "I get home with groceries"),
      beforePrompt("prompt-routine-2426", "you put cold food in the fridge", "차가운 음식을 냉장고에 넣기 전에", "I put cold food in the fridge"),
      whenPrompt("prompt-routine-2427", "you stop by a store on the way home", "집에 가는 길에 가게에 잠깐 들를 때", "I stop by a store on the way home"),
      afterPrompt("prompt-routine-2428", "you realize you forgot one item", "한 가지를 빠뜨린 걸 알고 난 뒤에", "I realize I forgot one item"),
      beforePrompt("prompt-routine-2429", "you carry your shopping bag home", "쇼핑백을 들고 집으로 가기 전에", "I carry my shopping bag home"),
      whenPrompt("prompt-routine-2430", "you make a short shopping list", "짧은 장보기 목록을 만들 때", "I make a short shopping list"),
    ],
  },
  {
    code: "cafe-and-bakery-stops",
    detailName: "Cafe Orders and Bakery Visits",
    detailOrder: 12,
    tip: "카페나 빵집에서 하는 간단한 행동을 순서대로 말해 보세요.",
    words: [
      word("counter", "카운터", "주문하거나 기다리는 곳을 말할 때 좋아요.", "I stand near the counter and wait.", "INTRO_ROUTINE_CAFE"),
      word("menu", "메뉴", "무엇을 고를지 고민할 때 자주 써요.", "I read the menu before I order.", "INTRO_ROUTINE_CAFE"),
      word("tray", "쟁반", "음식을 옮길 때 쓰는 것을 말할 때 좋아요.", "I carry my tray carefully to the table.", "INTRO_ROUTINE_CAFE"),
      word("cup", "컵", "마시는 것을 가장 쉽게 말할 수 있는 단어예요.", "The cup feels warm in my hands.", "INTRO_ROUTINE_CAFE"),
      word("straw", "빨대", "차가운 음료를 말할 때 함께 쓰기 좋아요.", "I ask for a straw with iced tea.", "INTRO_ROUTINE_CAFE"),
      word("pastry", "페이스트리, 빵", "빵집에서 고르는 간단한 빵을 말할 때 좋아요.", "I choose one pastry for the afternoon.", "INTRO_ROUTINE_CAFE"),
      word("bakery", "빵집", "장소를 말할 때 가장 기본이 되는 단어예요.", "The bakery is small but popular.", "INTRO_ROUTINE_CAFE"),
      word("napkin", "냅킨", "먹고 마신 뒤 정리하는 흐름에 잘 맞아요.", "I take an extra napkin from the counter.", "INTRO_ROUTINE_CAFE"),
      word("table", "테이블", "앉는 위치를 말할 때 자주 써요.", "I choose a table near the window.", "INTRO_ROUTINE_CAFE"),
      word("order", "주문", "카페 흐름 전체를 말할 때 꼭 필요한 단어예요.", "My order is ready in a few minutes.", "INTRO_ROUTINE_CAFE"),
    ],
    phrases: [
      phrase("look at the menu", "메뉴를 보다", "무엇을 고를지 생각할 때 자연스러워요.", "I look at the menu for a minute.", "INTRO_ROUTINE_CAFE"),
      phrase("order a drink", "음료를 주문하다", "카페에서 가장 자주 쓰는 표현이에요.", "I order a drink and a small snack.", "INTRO_ROUTINE_CAFE"),
      phrase("wait for my order", "내 주문을 기다리다", "주문 뒤 흐름을 말할 때 좋아요.", "I wait for my order near the counter.", "INTRO_ROUTINE_CAFE"),
      phrase("find a seat", "자리를 찾다", "앉는 행동을 아주 간단하게 말할 수 있어요.", "I find a seat in the back of the cafe.", "INTRO_ROUTINE_CAFE"),
      phrase("take it to go", "포장해서 가져가다", "머물지 않고 나갈 때 자주 써요.", "I take it to go when I am in a hurry.", "INTRO_ROUTINE_CAFE"),
    ],
    prompts: [
      beforePrompt("prompt-routine-2431", "you order a drink at a cafe", "카페에서 음료를 주문하기 전에", "I order a drink at a cafe"),
      afterPrompt("prompt-routine-2432", "you look at the menu", "메뉴를 본 뒤에", "I look at the menu"),
      whilePrompt("prompt-routine-2433", "you wait for your order", "주문한 음료나 빵을 기다리면서", "I wait for my order"),
      afterPrompt("prompt-routine-2434", "you find a seat", "자리를 찾은 뒤에", "I find a seat"),
      beforePrompt("prompt-routine-2435", "you take a pastry out of the bag", "빵 봉투에서 빵을 꺼내기 전에", "I take a pastry out of the bag"),
      whenPrompt("prompt-routine-2436", "you stop by a bakery in the afternoon", "오후에 빵집에 잠깐 들를 때", "I stop by a bakery in the afternoon"),
      afterPrompt("prompt-routine-2437", "you carry your tray to the table", "쟁반을 테이블로 옮긴 뒤에", "I carry my tray to the table"),
      beforePrompt("prompt-routine-2438", "you take your first sip", "첫 모금을 마시기 전에", "I take my first sip"),
      whilePrompt("prompt-routine-2439", "you wait near the counter", "카운터 근처에서 기다리면서", "I wait near the counter"),
      afterPrompt("prompt-routine-2440", "you decide to take your drink to go", "음료를 포장해서 가져가기로 한 뒤에", "I decide to take my drink to go"),
      beforePrompt("prompt-routine-2441", "you choose between two kinds of bread", "두 가지 종류의 빵 중 하나를 고르기 전에", "I choose between two kinds of bread"),
      afterPrompt("prompt-routine-2442", "you leave the cafe with your drink", "음료를 들고 카페를 나온 뒤에", "I leave the cafe with my drink"),
      whenPrompt("prompt-routine-2443", "you stop by a bakery after work or class", "일이나 수업이 끝난 뒤 빵집에 잠깐 들를 때", "I stop by a bakery after work or class"),
      beforePrompt("prompt-routine-2444", "you throw away your cup and napkin", "컵과 냅킨을 버리기 전에", "I throw away my cup and napkin"),
      afterPrompt("prompt-routine-2445", "you finish your drink at a cafe", "카페에서 음료를 다 마신 뒤에", "I finish my drink at a cafe"),
    ],
  },
  {
    code: "walking-and-light-exercise",
    detailName: "Walking, Stretching, and Cooldown",
    detailOrder: 13,
    tip: "가볍게 몸을 움직일 때 하는 행동을 차례대로 말해 보세요.",
    words: [
      word("sneakers", "운동화", "걷거나 가볍게 움직일 때 가장 자주 나와요.", "I wear sneakers for a short walk.", "INTRO_ROUTINE_WALK"),
      word("mat", "매트", "스트레칭이나 홈 운동을 말할 때 좋아요.", "I keep my mat by the wall.", "INTRO_ROUTINE_WALK"),
      word("bottle", "물병", "운동 전후 준비를 말할 때 유용해요.", "I bring a bottle of water with me.", "INTRO_ROUTINE_WALK"),
      word("pace", "속도", "천천히 걷는지 빠르게 걷는지 말할 때 좋아요.", "I keep a steady pace on my walk.", "INTRO_ROUTINE_WALK"),
      word("stretch", "스트레칭", "짧게 몸을 푸는 행동을 가장 쉽게 말할 수 있어요.", "I do a short stretch before I move.", "INTRO_ROUTINE_WALK"),
      word("steps", "걸음 수", "걷기 양을 말할 때 자주 써요.", "I count my steps on my phone.", "INTRO_ROUTINE_WALK"),
      word("park", "공원", "가볍게 움직이는 장소를 말할 때 좋아요.", "The park is close to my house.", "INTRO_ROUTINE_WALK"),
      word("timer", "타이머", "짧은 운동 시간을 재는 상황에 잘 맞아요.", "I set a timer for ten minutes.", "INTRO_ROUTINE_WALK"),
      word("bench", "벤치", "쉬는 지점을 말할 때 자연스러워요.", "I sit on a bench after walking.", "INTRO_ROUTINE_WALK"),
      word("muscles", "근육", "몸이 풀리거나 뻐근한 느낌을 말할 때 좋아요.", "My muscles feel better after stretching.", "INTRO_ROUTINE_WALK"),
    ],
    phrases: [
      phrase("go for a walk", "산책하러 가다", "가볍게 밖에 나갈 때 가장 기본이 되는 표현이에요.", "I go for a walk after dinner.", "INTRO_ROUTINE_WALK"),
      phrase("do a quick stretch", "간단히 스트레칭하다", "짧게 몸을 푸는 말을 할 때 좋아요.", "I do a quick stretch before I sit down again.", "INTRO_ROUTINE_WALK"),
      phrase("put on my sneakers", "운동화를 신다", "걷기 전 준비를 말할 때 아주 자연스러워요.", "I put on my sneakers and head outside.", "INTRO_ROUTINE_WALK"),
      phrase("bring my water bottle", "물병을 챙기다", "밖에 나가기 전 준비 행동으로 좋아요.", "I bring my water bottle when it is hot.", "INTRO_ROUTINE_WALK"),
      phrase("cool down slowly", "천천히 숨을 고르다", "운동 뒤 마무리를 말할 때 좋아요.", "I cool down slowly after I finish moving.", "INTRO_ROUTINE_WALK"),
    ],
    prompts: [
      beforePrompt("prompt-routine-2446", "you go out for a short walk", "짧게 산책하러 나가기 전에", "I go out for a short walk"),
      afterPrompt("prompt-routine-2447", "you start a short walk", "짧은 산책을 시작한 뒤에", "I start a short walk"),
      whilePrompt("prompt-routine-2448", "you walk around your neighborhood", "동네를 걸으면서", "I walk around my neighborhood"),
      beforePrompt("prompt-routine-2449", "you do a quick stretch", "간단히 스트레칭하기 전에", "I do a quick stretch"),
      afterPrompt("prompt-routine-2450", "you finish a short workout", "짧은 운동을 마친 뒤에", "I finish a short workout"),
      whenPrompt("prompt-routine-2451", "you want to stretch after sitting", "오래 앉아 있다가 스트레칭하고 싶을 때", "I want to stretch after sitting"),
      beforePrompt("prompt-routine-2452", "you bring your water bottle outside", "물병을 챙겨 밖으로 나가기 전에", "I bring my water bottle outside"),
      afterPrompt("prompt-routine-2453", "you sit on a bench to rest", "벤치에 앉아 잠깐 쉰 뒤에", "I sit on a bench to rest"),
      whilePrompt("prompt-routine-2454", "you count your steps", "걸음 수를 세면서", "I count my steps"),
      beforePrompt("prompt-routine-2455", "you start a short walk on a lazy day", "움직이기 귀찮은 날 짧게 걷기 전에", "I start a short walk on a lazy day"),
      whenPrompt("prompt-routine-2456", "you go to a park for a short walk", "공원에 짧게 걸으러 갈 때", "I go to a park for a short walk"),
      afterPrompt("prompt-routine-2457", "you cool down slowly", "천천히 숨을 고른 뒤에", "I cool down slowly"),
      beforePrompt("prompt-routine-2458", "you roll out an exercise mat", "운동 매트를 펴기 전에", "I roll out an exercise mat"),
      whenPrompt("prompt-routine-2459", "you only have ten minutes to exercise", "운동할 시간이 10분 정도밖에 없을 때", "I only have ten minutes to exercise"),
      afterPrompt("prompt-routine-2460", "you come back from a walk", "산책하고 돌아온 뒤에", "I come back from a walk"),
    ],
  },
  {
    code: "shower-and-bedtime-prep",
    detailName: "Night Shower and Bedtime Prep",
    detailOrder: 14,
    tip: "잠들기 전 씻고 정리하는 순서를 차분하게 말해 보세요.",
    words: [
      word("towel", "수건", "샤워 뒤에 가장 먼저 떠오르는 물건이에요.", "I hang my towel on the rack.", "INTRO_ROUTINE_NIGHT"),
      word("toothbrush", "칫솔", "잠들기 전 준비를 말할 때 자주 나와요.", "My toothbrush is next to the sink.", "INTRO_ROUTINE_NIGHT"),
      word("slippers", "슬리퍼", "밤에 편하게 움직일 때 신는 것을 말해요.", "I put on my slippers after washing up.", "INTRO_ROUTINE_NIGHT"),
      word("shower", "샤워", "밤 루틴에서 핵심이 되는 기본 단어예요.", "A warm shower helps me relax.", "INTRO_ROUTINE_NIGHT"),
      word("mirror", "거울", "마지막으로 얼굴을 보는 장면을 말할 때 좋아요.", "I look in the mirror before bed.", "INTRO_ROUTINE_NIGHT"),
      word("pajamas", "잠옷", "잠잘 준비를 구체적으로 말할 때 좋아요.", "I change into pajamas after my shower.", "INTRO_ROUTINE_NIGHT"),
      word("soap", "비누", "씻는 과정을 가장 쉽게 보여줄 수 있어요.", "The soap smells clean and fresh.", "INTRO_ROUTINE_NIGHT"),
      word("steam", "수증기", "따뜻한 욕실 분위기를 말할 때 좋아요.", "The bathroom gets warm with steam.", "INTRO_ROUTINE_NIGHT"),
      word("blanket", "담요", "침대로 가는 마지막 장면을 말할 때 좋아요.", "My blanket feels warm and soft.", "INTRO_ROUTINE_NIGHT"),
      word("lotion", "로션", "씻은 뒤 바르는 것을 말할 때 자연스러워요.", "I use lotion on my hands at night.", "INTRO_ROUTINE_NIGHT"),
    ],
    phrases: [
      phrase("take a quick shower", "간단히 샤워하다", "밤에 씻는 루틴을 가장 쉽게 말할 수 있어요.", "I take a quick shower before bed.", "INTRO_ROUTINE_NIGHT"),
      phrase("brush my teeth", "양치하다", "잠들기 전 습관을 말할 때 꼭 필요한 표현이에요.", "I brush my teeth right after I wash up.", "INTRO_ROUTINE_NIGHT"),
      phrase("put on my pajamas", "잠옷을 입다", "밤 루틴의 전환을 자연스럽게 보여줘요.", "I put on my pajamas and feel relaxed.", "INTRO_ROUTINE_NIGHT"),
      phrase("wash up", "씻고 정리하다", "샤워나 세수를 넓게 말할 때 편해요.", "I wash up before I sit on my bed.", "INTRO_ROUTINE_NIGHT"),
      phrase("turn off the bathroom light", "욕실 불을 끄다", "욕실에서 나오는 마지막 행동을 말할 때 좋아요.", "I turn off the bathroom light and go to my room.", "INTRO_ROUTINE_NIGHT"),
    ],
    prompts: [
      beforePrompt("prompt-routine-2461", "you take a shower at night", "밤에 샤워하기 전에", "I take a shower at night"),
      afterPrompt("prompt-routine-2462", "you hang up your towel", "수건을 걸어 둔 뒤에", "I hang up my towel"),
      beforePrompt("prompt-routine-2463", "you brush your teeth", "양치하기 전에", "I brush my teeth"),
      afterPrompt("prompt-routine-2464", "you put on your pajamas", "잠옷을 입은 뒤에", "I put on my pajamas"),
      whenPrompt("prompt-routine-2465", "you finish washing up", "씻고 정리를 마쳤을 때", "I finish washing up"),
      beforePrompt("prompt-routine-2466", "you look in the mirror one last time", "마지막으로 거울을 보기 전에", "I look in the mirror one last time"),
      afterPrompt("prompt-routine-2467", "you turn off the bathroom light", "욕실 불을 끈 뒤에", "I turn off the bathroom light"),
      whilePrompt("prompt-routine-2468", "you wait for the shower water to warm up", "샤워 물이 따뜻해지기를 기다리면서", "I wait for the shower water to warm up"),
      beforePrompt("prompt-routine-2469", "you put on your slippers", "슬리퍼를 신기 전에", "I put on my slippers"),
      afterPrompt("prompt-routine-2470", "you use lotion at night", "밤에 로션을 바른 뒤에", "I use lotion at night"),
      whenPrompt("prompt-routine-2471", "you want to feel clean before bed", "잠들기 전에 개운해지고 싶을 때", "I want to feel clean before bed"),
      beforePrompt("prompt-routine-2472", "you fold the towel after a shower", "샤워 뒤 수건을 접기 전에", "I fold the towel after a shower"),
      afterPrompt("prompt-routine-2473", "you leave the bathroom at night", "밤에 욕실에서 나온 뒤에", "I leave the bathroom at night"),
      whilePrompt("prompt-routine-2474", "the bathroom gets warm and steamy", "욕실이 따뜻하고 수증기로 가득해지면서", "the bathroom gets warm and steamy"),
      beforePrompt("prompt-routine-2475", "you get under the blanket", "이불 속으로 들어가기 전에", "I get under the blanket"),
    ],
  },
];

const preferencePacks = [
  {
    code: "everyday-drinks-and-bottles",
    detailName: "Everyday Drinks and Water Bottles",
    detailOrder: 10,
    tip: "매일 마시는 음료나 물병을 떠올리고 편한 점을 함께 말해 보세요.",
    words: [
      word("bottle", "물병", "매일 들고 다니는 물건을 말할 때 기본이 되는 단어예요.", "I carry a bottle in my bag every day.", "INTRO_PREF_DRINKS"),
      word("tumbler", "텀블러", "차갑거나 따뜻한 음료를 오래 보관할 때 자주 써요.", "My tumbler keeps my drink cold for hours.", "INTRO_PREF_DRINKS"),
      word("refill", "다시 채우다", "자주 채워 마시는 습관을 말할 때 좋아요.", "I refill my bottle at school.", "INTRO_PREF_DRINKS"),
      word("ice", "얼음", "차가운 음료 취향을 말할 때 자주 나와요.", "I like a lot of ice in summer.", "INTRO_PREF_DRINKS"),
      word("lemon", "레몬", "물에 넣는 맛을 말할 때 간단하고 좋아요.", "Lemon makes water taste fresh.", "INTRO_PREF_DRINKS"),
      word("sparkling", "탄산이 있는", "탄산수나 음료 취향을 말할 때 좋아요.", "Sparkling water feels more refreshing to me.", "INTRO_PREF_DRINKS"),
      word("juice", "주스", "점심이나 간식과 함께 마시는 음료를 말할 때 좋아요.", "I sometimes drink juice with lunch.", "INTRO_PREF_DRINKS"),
      word("straw", "빨대", "마시는 도구 취향을 말할 때 유용해요.", "A reusable straw is easy to carry.", "INTRO_PREF_DRINKS"),
      word("lid", "뚜껑", "새지 않는 점을 말할 때 자주 써요.", "The lid closes tightly and well.", "INTRO_PREF_DRINKS"),
      word("sip", "한 모금 마시다", "조금씩 마시는 습관을 말할 때 좋아요.", "I take a sip while I study.", "INTRO_PREF_DRINKS"),
    ],
    phrases: [
      phrase("easy to carry around", "들고 다니기 편하다", "매일 쓰는 물건의 장점을 말할 때 좋아요.", "It is easy to carry around all day.", "INTRO_PREF_DRINKS"),
      phrase("keeps my drink cold", "음료를 차갑게 유지해 준다", "텀블러나 병의 장점을 말할 때 좋아요.", "It keeps my drink cold until afternoon.", "INTRO_PREF_DRINKS"),
      phrase("not too sweet", "너무 달지 않다", "음료 맛 취향을 말할 때 자연스러워요.", "I like it because it is not too sweet.", "INTRO_PREF_DRINKS"),
      phrase("easy to refill", "다시 채우기 쉽다", "자주 쓰는 병의 편리함을 말할 때 좋아요.", "It is easy to refill at any sink.", "INTRO_PREF_DRINKS"),
      phrase("good with ice", "얼음과 잘 어울리다", "차가운 음료 취향을 말할 때 좋아요.", "This drink is really good with ice.", "INTRO_PREF_DRINKS"),
    ],
    prompts: [
      favoritePrompt("prompt-preference-2501", "water bottle for daily use", "매일 쓰기 좋은 물병"),
      favoritePrompt("prompt-preference-2502", "tumbler for refilling during the day", "낮 동안 물을 리필하며 쓰기 좋은 텀블러"),
      favoritePrompt("prompt-preference-2503", "sparkling water flavor", "탄산수 맛"),
      favoritePrompt("prompt-preference-2504", "drink to carry on a walk", "산책할 때 들고 가기 좋은 음료"),
      favoritePrompt("prompt-preference-2505", "juice flavor to have with lunch", "점심과 함께 마시기 좋은 주스 맛"),
      favoritePrompt("prompt-preference-2506", "fruit to add to water", "물에 넣기 좋은 과일"),
      promptSpec("prompt-preference-2507", "What bottle do you like best for carrying around, and why do you like it?", "들고 다니기 좋은 물병은 무엇이고, 왜 좋아하나요?", "The bottle I like best for carrying around is ... because ..."),
      favoritePrompt("prompt-preference-2508", "drink to enjoy with a straw on a hot day", "더운 날 빨대로 마시기 좋은 음료"),
      favoritePrompt("prompt-preference-2509", "drink to keep cold in summer", "여름에 차갑게 마시기 좋은 음료"),
      favoritePrompt("prompt-preference-2510", "drink to sip during study time", "공부할 때 조금씩 마시기 좋은 음료"),
      favoritePrompt("prompt-preference-2511", "reusable cup for going out", "외출할 때 들고 가기 좋은 재사용 컵"),
      favoritePrompt("prompt-preference-2512", "drink after light exercise", "가벼운 운동 뒤 마시기 좋은 음료"),
      favoritePrompt("prompt-preference-2513", "cold drink with ice on a hot day", "더운 날 얼음을 넣어 마시기 좋은 차가운 음료"),
      promptSpec("prompt-preference-2514", "What bottle shape feels best in your hand, and why do you like it?", "손에 쥐었을 때 가장 편한 물병 모양은 무엇이고, 왜 좋아하나요?", "The bottle shape that feels best in my hand is ... because ..."),
      promptSpec("prompt-preference-2515", "What is your favorite drink when you get home on a warm day, and why do you like it?", "따뜻한 날 집에 돌아왔을 때 마시기 좋은 음료는 무엇이고, 왜 좋아하나요?", "My favorite drink when I get home on a warm day is ... because ..."),
    ],
  },
  {
    code: "bags-and-daily-carry-items",
    detailName: "Bags and Daily Carry Items",
    detailOrder: 11,
    tip: "매일 들고 다니는 가방이나 작은 물건을 떠올리고 편한 점을 말해 보세요.",
    words: [
      word("backpack", "백팩", "매일 쓰는 가방을 말할 때 가장 기본적인 단어예요.", "I use a backpack for work and study.", "INTRO_PREF_BAGS"),
      word("tote", "토트백", "가볍게 들고 다니는 가방을 말할 때 좋아요.", "A tote is easy for a short trip.", "INTRO_PREF_BAGS"),
      word("pouch", "파우치", "작은 물건을 따로 넣는 용도로 자주 써요.", "I keep my cables in a small pouch.", "INTRO_PREF_BAGS"),
      word("wallet", "지갑", "자주 꺼내는 물건을 말할 때 자연스러워요.", "My wallet is small and simple.", "INTRO_PREF_BAGS"),
      word("keychain", "열쇠고리", "작지만 자주 쓰는 물건을 말할 때 좋아요.", "A bright keychain is easy to find.", "INTRO_PREF_BAGS"),
      word("strap", "끈", "가방 길이나 편안함을 말할 때 써요.", "The strap feels soft on my shoulder.", "INTRO_PREF_BAGS"),
      word("zipper", "지퍼", "닫히는 방식의 편리함을 말할 때 좋아요.", "The zipper opens smoothly and quickly.", "INTRO_PREF_BAGS"),
      word("pocket", "주머니, 수납칸", "정리하기 쉬운 점을 말할 때 유용해요.", "The side pocket is good for my bottle.", "INTRO_PREF_BAGS"),
      word("cardholder", "카드지갑", "작게 들고 다니는 물건을 말할 때 좋아요.", "A cardholder is enough for short trips.", "INTRO_PREF_BAGS"),
      word("charger", "충전기", "매일 챙기는 전자 소품을 말할 때 자주 써요.", "I carry a charger in my bag.", "INTRO_PREF_BAGS"),
    ],
    phrases: [
      phrase("easy to carry", "들고 다니기 쉽다", "가방이나 소품의 장점을 가장 간단히 말할 수 있어요.", "It is easy to carry every day.", "INTRO_PREF_BAGS"),
      phrase("fits everything I need", "필요한 것이 다 들어간다", "수납력을 말할 때 자연스러워요.", "It fits everything I need for the day.", "INTRO_PREF_BAGS"),
      phrase("easy to find inside", "안에서 찾기 쉽다", "정리하기 편한 이유를 말할 때 좋아요.", "My things are easy to find inside.", "INTRO_PREF_BAGS"),
      phrase("light on my shoulder", "어깨에 부담이 적다", "가볍고 편한 느낌을 말할 때 좋아요.", "It is light on my shoulder even after hours.", "INTRO_PREF_BAGS"),
      phrase("has useful pockets", "쓸모 있는 수납칸이 있다", "가방 구조의 장점을 말할 때 좋아요.", "It has useful pockets for small items.", "INTRO_PREF_BAGS"),
    ],
    prompts: [
      favoritePrompt("prompt-preference-2516", "backpack for daily use", "매일 쓰기 좋은 백팩"),
      favoritePrompt("prompt-preference-2517", "tote bag for a short trip", "짧게 외출할 때 좋은 토트백"),
      favoritePrompt("prompt-preference-2518", "small pouch in your bag", "가방 안에 넣는 작은 파우치"),
      favoritePrompt("prompt-preference-2519", "wallet for daily use", "매일 쓰기 좋은 지갑"),
      favoritePrompt("prompt-preference-2520", "keychain to use every day", "매일 쓰기 좋은 열쇠고리"),
      favoritePrompt("prompt-preference-2521", "bag pocket for carrying a water bottle", "물병을 넣기 좋은 가방 수납칸"),
      promptSpec("prompt-preference-2522", "What kind of bag zipper do you like best, and why do you like it?", "가장 좋아하는 가방 지퍼는 어떤 것이고, 왜 좋나요?", "The kind of bag zipper I like best is ... because ..."),
      favoritePrompt("prompt-preference-2523", "cardholder", "카드지갑"),
      promptSpec("prompt-preference-2524", "What kind of bag strap do you like best, and why do you like it?", "가장 좋아하는 가방 끈은 어떤 것이고, 왜 좋나요?", "The kind of bag strap I like best is ... because ..."),
      promptSpec("prompt-preference-2525", "What kind of everyday bag do you like best, and why do you like it?", "매일 쓰기 좋은 가방은 어떤 것이고, 왜 좋나요?", "The kind of everyday bag I like best is ... because ..."),
      favoritePrompt("prompt-preference-2526", "foldable shopping bag", "접이식 장바구니"),
      favoritePrompt("prompt-preference-2527", "portable charger to carry", "들고 다니기 좋은 휴대용 충전기"),
      favoritePrompt("prompt-preference-2528", "pouch for pens or cables", "펜이나 케이블을 넣기 좋은 파우치"),
      favoritePrompt("prompt-preference-2529", "bag to use on rainy days", "비 오는 날 쓰기 좋은 가방"),
      favoritePrompt("prompt-preference-2530", "small bag for a quick trip outside", "잠깐 외출할 때 좋은 작은 가방"),
    ],
  },
  {
    code: "cleaning-and-organizing-helpers",
    detailName: "Storage and Organizing Tools",
    detailOrder: 12,
    tip: "정리나 청소를 편하게 해 주는 물건을 떠올리고 이유를 함께 말해 보세요.",
    words: [
      word("shelf", "선반", "정리 공간을 말할 때 가장 기본이 되는 단어예요.", "A small shelf keeps my room neat.", "INTRO_PREF_ORGANIZE"),
      word("drawer", "서랍", "작은 물건을 넣어 두는 곳을 말할 때 좋아요.", "I use one drawer for cables and paper.", "INTRO_PREF_ORGANIZE"),
      word("hanger", "옷걸이", "옷을 정리할 때 자주 쓰는 단어예요.", "A strong hanger keeps my clothes in shape.", "INTRO_PREF_ORGANIZE"),
      word("basket", "바구니", "한곳에 모아 두는 물건을 말할 때 좋아요.", "I keep towels in a basket.", "INTRO_PREF_ORGANIZE"),
      word("label", "라벨", "구분하기 쉬운 이유를 말할 때 좋아요.", "A label helps me find things faster.", "INTRO_PREF_ORGANIZE"),
      word("hook", "고리", "걸어서 보관하는 물건을 말할 때 좋아요.", "I hang my keys on a hook.", "INTRO_PREF_ORGANIZE"),
      word("cloth", "천, 행주", "가볍게 닦을 때 쓰는 것을 말할 수 있어요.", "A soft cloth is good for my desk.", "INTRO_PREF_ORGANIZE"),
      word("spray", "스프레이", "간단히 뿌리고 닦는 도구를 말할 때 좋아요.", "I use a spray for quick cleaning.", "INTRO_PREF_ORGANIZE"),
      word("sponge", "스펀지", "주방 청소 도구를 말할 때 자주 써요.", "This sponge is easy to hold.", "INTRO_PREF_ORGANIZE"),
      word("box", "상자", "작은 물건을 담아 두는 표현으로 좋아요.", "A small box keeps my desk tidy.", "INTRO_PREF_ORGANIZE"),
    ],
    phrases: [
      phrase("keeps things in place", "물건이 제자리에 있게 해 준다", "정리 도구의 핵심 장점을 말할 때 좋아요.", "It keeps things in place and easy to find.", "INTRO_PREF_ORGANIZE"),
      phrase("easy to wipe clean", "닦기 쉽다", "청소 도구나 재질의 장점을 말할 때 좋아요.", "It is easy to wipe clean after use.", "INTRO_PREF_ORGANIZE"),
      phrase("saves me time", "시간을 아껴 준다", "편리한 이유를 간단히 설명할 때 좋아요.", "It saves me time every morning.", "INTRO_PREF_ORGANIZE"),
      phrase("makes my room look neater", "방이 더 깔끔해 보이게 한다", "정리 도구를 좋아하는 이유로 자연스러워요.", "It makes my room look neater right away.", "INTRO_PREF_ORGANIZE"),
      phrase("easy to put away", "정리해서 넣기 쉽다", "쓰고 나서 보관이 편하다는 말을 할 때 좋아요.", "It is easy to put away after I use it.", "INTRO_PREF_ORGANIZE"),
    ],
    prompts: [
      favoritePrompt("prompt-preference-2531", "storage box at home", "집에서 쓰는 수납 상자"),
      favoritePrompt("prompt-preference-2532", "hanger type for daily clothes", "평소 입는 옷에 잘 맞는 옷걸이 종류"),
      favoritePrompt("prompt-preference-2533", "drawer organizer", "서랍 정리함"),
      favoritePrompt("prompt-preference-2534", "wall hook to use at home", "집에서 쓰기 좋은 벽걸이 고리"),
      favoritePrompt("prompt-preference-2535", "box for small items", "작은 물건을 넣기 좋은 상자"),
      favoritePrompt("prompt-preference-2536", "cleaning cloth for your desk", "책상을 닦기 좋은 천"),
      favoritePrompt("prompt-preference-2537", "spray bottle for easy cleaning", "가볍게 청소하기 좋은 스프레이 병"),
      favoritePrompt("prompt-preference-2538", "sponge for the kitchen", "주방에서 쓰기 좋은 스펀지"),
      favoritePrompt("prompt-preference-2539", "small shelf in your room", "방 안에 두기 좋은 작은 선반"),
      promptSpec("prompt-preference-2540", "What kind of label do you like best for organizing, and why do you like it?", "정리할 때 가장 좋아하는 라벨은 어떤 것이고, 왜 좋나요?", "The kind of label I like best for organizing is ... because ..."),
      favoritePrompt("prompt-preference-2541", "organizer for a bathroom drawer", "욕실 서랍 정리함"),
      favoritePrompt("prompt-preference-2542", "shoe box to reuse at home", "집에서 다시 쓰기 좋은 신발 상자"),
      favoritePrompt("prompt-preference-2543", "box to keep cables in", "케이블을 넣어 두기 좋은 상자"),
      favoritePrompt("prompt-preference-2544", "basket to hold towels", "수건을 담아 두기 좋은 바구니"),
      favoritePrompt("prompt-preference-2545", "hook near the door for bags or keys", "문 근처에서 가방이나 열쇠를 걸기 좋은 고리"),
    ],
  },
  {
    code: "home-devices-and-small-gadgets",
    detailName: "Small Home Gadgets",
    detailOrder: 13,
    tip: "집에서 자주 쓰는 작은 기기를 떠올리고 편한 이유를 말해 보세요.",
    words: [
      word("charger", "충전기", "매일 쓰는 전자기기를 말할 때 가장 자주 나와요.", "I keep one charger by my bed.", "INTRO_PREF_GADGETS"),
      word("cable", "케이블", "길이나 정리 상태를 말할 때 좋아요.", "A long cable is more useful for me.", "INTRO_PREF_GADGETS"),
      word("speaker", "스피커", "음악을 듣는 기기를 말할 때 좋아요.", "A small speaker is enough for my room.", "INTRO_PREF_GADGETS"),
      word("fan", "선풍기", "더운 날 자주 쓰는 기기를 말할 때 좋아요.", "My fan is small but strong.", "INTRO_PREF_GADGETS"),
      word("clock", "시계", "알람이나 시간을 확인할 때 자주 나와요.", "I like a clock with simple numbers.", "INTRO_PREF_GADGETS"),
      word("stand", "받침대", "휴대폰이나 태블릿을 세워 둘 때 좋아요.", "A stand helps me watch videos easily.", "INTRO_PREF_GADGETS"),
      word("lamp", "램프", "밤에 불을 켤 때 쓰는 기기를 말할 수 있어요.", "I use a lamp for reading at night.", "INTRO_PREF_GADGETS"),
      word("timer", "타이머", "짧은 시간을 재는 습관을 말할 때 좋아요.", "A timer helps me focus for ten minutes.", "INTRO_PREF_GADGETS"),
      word("humidifier", "가습기", "건조한 날씨에 쓰는 기기를 말할 때 좋아요.", "A humidifier helps my room feel better.", "INTRO_PREF_GADGETS"),
      word("power strip", "멀티탭", "여러 기기를 연결하는 도구를 말할 때 좋아요.", "I use a power strip under my desk.", "INTRO_PREF_GADGETS"),
    ],
    phrases: [
      phrase("easy to use", "쓰기 쉽다", "작은 기기를 좋아하는 이유로 가장 자연스러워요.", "It is easy to use every day.", "INTRO_PREF_GADGETS"),
      phrase("does the job well", "제 역할을 잘한다", "기능이 충분하다는 뜻으로 좋아요.", "It does the job well without being expensive.", "INTRO_PREF_GADGETS"),
      phrase("easy to move around", "옮기기 쉽다", "작고 가벼운 기기의 장점을 말할 때 좋아요.", "It is easy to move around the room.", "INTRO_PREF_GADGETS"),
      phrase("fits in a small space", "작은 공간에 잘 들어간다", "방이 좁을 때 편한 이유를 말할 수 있어요.", "It fits in a small space on my desk.", "INTRO_PREF_GADGETS"),
      phrase("helps every day", "매일 도움이 된다", "자주 쓰는 기기의 장점을 넓게 말할 때 좋아요.", "It helps every day, so I use it often.", "INTRO_PREF_GADGETS"),
    ],
    prompts: [
      favoritePrompt("prompt-preference-2546", "phone charger at home", "집에서 쓰는 휴대폰 충전기"),
      favoritePrompt("prompt-preference-2547", "cable length for daily use", "평소 쓰기 좋은 케이블 길이"),
      favoritePrompt("prompt-preference-2548", "small speaker for background music", "배경 음악 듣기 좋은 작은 스피커"),
      favoritePrompt("prompt-preference-2549", "desk fan for warm days", "더운 날 책상에서 쓰기 좋은 선풍기"),
      favoritePrompt("prompt-preference-2550", "alarm clock style", "알람 시계 스타일"),
      favoritePrompt("prompt-preference-2551", "phone stand on your desk", "책상 위에서 쓰기 좋은 휴대폰 거치대"),
      favoritePrompt("prompt-preference-2552", "bedside lamp", "침대 옆에서 쓰는 램프"),
      favoritePrompt("prompt-preference-2553", "timer for short tasks", "짧은 일에 쓰기 좋은 타이머"),
      favoritePrompt("prompt-preference-2554", "compact humidifier", "작은 가습기"),
      favoritePrompt("prompt-preference-2555", "power strip at home", "집에서 쓰는 멀티탭"),
      favoritePrompt("prompt-preference-2556", "reading lamp", "독서용 램프"),
      favoritePrompt("prompt-preference-2557", "charger to keep by your bed", "침대 옆에 두기 좋은 충전기"),
      favoritePrompt("prompt-preference-2558", "portable fan", "휴대하기 좋은 선풍기"),
      promptSpec("prompt-preference-2559", "What kind of tablet stand do you like best, and why?", "가장 좋아하는 태블릿 거치대는 어떤 것이고, 왜 좋아하나요?", "The kind of tablet stand I like best is ... because ..."),
      favoritePrompt("prompt-preference-2560", "clip-on lamp for a desk or bed", "책상이나 침대에 끼워 쓰는 램프"),
    ],
  },
  {
    code: "kitchen-helpers-and-food-storage",
    detailName: "Kitchen Tools and Food Containers",
    detailOrder: 14,
    tip: "주방에서 자주 쓰는 도구를 떠올리고 편한 이유를 말해 보세요.",
    words: [
      word("container", "보관 용기", "남은 음식을 넣어 두는 물건을 말할 때 좋아요.", "I keep fruit in a clear container.", "INTRO_PREF_KITCHEN"),
      word("lid", "뚜껑", "잘 닫히는 점을 말할 때 가장 자주 나와요.", "The lid closes tightly and safely.", "INTRO_PREF_KITCHEN"),
      word("kettle", "주전자", "따뜻한 물을 끓일 때 쓰는 기기를 말할 때 좋아요.", "The kettle boils water quickly.", "INTRO_PREF_KITCHEN"),
      word("tray", "쟁반", "간식이나 컵을 옮길 때 쓰는 도구를 말할 때 좋아요.", "I use a tray for tea and snacks.", "INTRO_PREF_KITCHEN"),
      word("spoon", "숟가락", "음식을 먹는 도구 취향을 말할 때 자연스러워요.", "A deep spoon is better for soup.", "INTRO_PREF_KITCHEN"),
      word("chopsticks", "젓가락", "집에서 자주 쓰는 식사 도구를 말할 수 있어요.", "I like chopsticks that are not too heavy.", "INTRO_PREF_KITCHEN"),
      word("board", "도마", "재료를 자를 때 쓰는 도구를 말할 때 좋아요.", "This board is easy to wash and dry.", "INTRO_PREF_KITCHEN"),
      word("towel", "주방 수건", "손이나 식기를 닦는 용도로 말할 때 좋아요.", "I keep a towel near the sink.", "INTRO_PREF_KITCHEN"),
      word("thermos", "보온병", "따뜻한 음료를 오래 보관할 때 말하기 좋아요.", "A thermos keeps tea warm for hours.", "INTRO_PREF_KITCHEN"),
      word("freezer", "냉동실", "보관 공간을 말할 때 기본이 되는 단어예요.", "The freezer has enough space for small foods.", "INTRO_PREF_KITCHEN"),
    ],
    phrases: [
      phrase("easy to wash", "씻기 쉽다", "주방 도구를 좋아하는 이유로 가장 자주 써요.", "It is easy to wash after I use it.", "INTRO_PREF_KITCHEN"),
      phrase("easy to store", "보관하기 쉽다", "공간을 덜 차지하는 장점을 말할 때 좋아요.", "It is easy to store in a small kitchen.", "INTRO_PREF_KITCHEN"),
      phrase("good for leftovers", "남은 음식을 담기 좋다", "보관 용기를 말할 때 자연스러워요.", "It is good for leftovers after dinner.", "INTRO_PREF_KITCHEN"),
      phrase("easy to hold", "잡기 쉽다", "손에 쥐는 도구의 편안함을 말할 때 좋아요.", "It is easy to hold even with one hand.", "INTRO_PREF_KITCHEN"),
      phrase("fits in the fridge", "냉장고에 잘 들어간다", "보관 용기의 장점을 말할 때 좋아요.", "It fits in the fridge without taking much space.", "INTRO_PREF_KITCHEN"),
    ],
    prompts: [
      favoritePrompt("prompt-preference-2561", "food container for leftovers", "남은 음식을 담아 두기 좋은 보관 용기"),
      favoritePrompt("prompt-preference-2562", "food container to keep in the fridge", "냉장고에 넣어 두기 좋은 보관 용기"),
      favoritePrompt("prompt-preference-2563", "food container for lunch", "점심 음식을 담기 좋은 용기"),
      favoritePrompt("prompt-preference-2564", "spoon to use for soup", "국 먹을 때 쓰기 좋은 숟가락"),
      favoritePrompt("prompt-preference-2565", "pair of chopsticks to use at home", "집에서 쓰기 좋은 젓가락"),
      favoritePrompt("prompt-preference-2566", "small tray for snacks", "간식 담기 좋은 작은 쟁반"),
      promptSpec("prompt-preference-2567", "What is your favorite easy-to-wash cutting board, and why do you like it?", "가장 좋아하는 씻기 편한 도마는 무엇이고, 왜 좋아하나요?", "My favorite easy-to-wash cutting board is ... because ..."),
      favoritePrompt("prompt-preference-2568", "kitchen towel", "주방 수건"),
      favoritePrompt("prompt-preference-2569", "kettle at home", "집에서 쓰는 주전자"),
      favoritePrompt("prompt-preference-2570", "thermos for a warm drink", "따뜻한 음료용 보온병"),
      favoritePrompt("prompt-preference-2571", "container to keep fruit in", "과일 보관용 용기"),
      favoritePrompt("prompt-preference-2572", "container for small freezer foods", "작은 냉동 식품을 담아 두기 좋은 용기"),
      favoritePrompt("prompt-preference-2573", "lunch box to use on a busy day", "바쁜 날 쓰기 좋은 도시락통"),
      favoritePrompt("prompt-preference-2574", "thermos to take outside", "밖에 들고 나가기 좋은 보온병"),
      favoritePrompt("prompt-preference-2575", "little container for sauce or snacks", "소스나 간식을 담기 좋은 작은 용기"),
    ],
  },
];

const answerModes = [
  { code: "ROUTINE", displayOrder: 1, variable: "@answer_mode_routine_id" },
  { code: "PREFERENCE", displayOrder: 2, variable: "@answer_mode_preference_id" },
];

const taskSlots = [
  { code: "MAIN_ANSWER", displayOrder: 1, variable: "@slot_main_answer_id" },
  { code: "REASON", displayOrder: 2, variable: "@slot_reason_id" },
  { code: "EXAMPLE", displayOrder: 3, variable: "@slot_example_id" },
  { code: "FEELING", displayOrder: 4, variable: "@slot_feeling_id" },
  { code: "ACTIVITY", displayOrder: 5, variable: "@slot_activity_id" },
  { code: "TIME_OR_PLACE", displayOrder: 6, variable: "@slot_time_or_place_id" },
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

function buildHintItemInsert(id, hintId, item, displayOrder) {
  return (
    `INSERT INTO prompt_hint_items (id, hint_id, item_type, content, meaning_ko, usage_tip_ko, example_en, expression_family, display_order, is_active)` +
    ` VALUES (` +
    `${sql(id)}, ${sql(hintId)}, ${sql(item.itemType)}, ${sql(item.content)}, ${sql(item.meaningKo)}, ${sql(item.usageTipKo)}, ${sql(item.exampleEn)}, ${sql(item.expressionFamily)}, ${displayOrder}, 1)` +
    ` ON DUPLICATE KEY UPDATE hint_id = VALUES(hint_id), item_type = VALUES(item_type), content = VALUES(content), meaning_ko = VALUES(meaning_ko), usage_tip_ko = VALUES(usage_tip_ko), example_en = VALUES(example_en), expression_family = VALUES(expression_family), display_order = VALUES(display_order), is_active = VALUES(is_active);`
  );
}

function buildHintRows(prompt, family, words, phrases) {
  const compactId = prompt.id.replace("prompt-", "");
  const starterHintId = `hint-${compactId}-1`;
  const wordHintId = `hint-${compactId}-2`;
  const phraseHintId = `hint-${compactId}-3`;
  const isRoutine = family === "routine";

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
    isRoutine ? "나는 보통 ..." : "내가 가장 좋아하는 것은 ...이고, 이유는 ...이다",
    isRoutine
      ? "바로 다음 행동을 한두 가지 덧붙여서 시작해 보세요."
      : "좋아하는 대상과 이유를 한 문장으로 먼저 말해 보세요.",
    isRoutine
      ? "I usually do one or two simple things that match my routine."
      : "My favorite one is simple, useful, and easy to enjoy every day.",
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

function buildTaskMetaRows(promptId, family) {
  const answerModeVar = family === "routine" ? "@answer_mode_routine_id" : "@answer_mode_preference_id";
  const requiredSecondVar = family === "routine" ? "@slot_activity_id" : "@slot_reason_id";
  const optionalThirdVar = family === "routine" ? "@slot_time_or_place_id" : "@slot_feeling_id";
  const optionalFourthVar = family === "routine" ? "@slot_feeling_id" : "@slot_example_id";

  return [
    `INSERT INTO prompt_task_profiles (prompt_id, answer_mode_id, expected_tense, expected_pov, is_active)` +
      ` VALUES (${sql(promptId)}, ${answerModeVar}, 'PRESENT_SIMPLE', 'FIRST_PERSON', 1)` +
      ` ON DUPLICATE KEY UPDATE answer_mode_id = VALUES(answer_mode_id), expected_tense = VALUES(expected_tense), expected_pov = VALUES(expected_pov), is_active = VALUES(is_active);`,
    `INSERT INTO prompt_task_profile_slots (prompt_id, slot_id, slot_role, display_order, is_active)` +
      ` VALUES (${sql(promptId)}, @slot_main_answer_id, 'REQUIRED', 1, 1)` +
      ` ON DUPLICATE KEY UPDATE display_order = VALUES(display_order), is_active = VALUES(is_active);`,
    `INSERT INTO prompt_task_profile_slots (prompt_id, slot_id, slot_role, display_order, is_active)` +
      ` VALUES (${sql(promptId)}, ${requiredSecondVar}, 'REQUIRED', 2, 1)` +
      ` ON DUPLICATE KEY UPDATE display_order = VALUES(display_order), is_active = VALUES(is_active);`,
    `INSERT INTO prompt_task_profile_slots (prompt_id, slot_id, slot_role, display_order, is_active)` +
      ` VALUES (${sql(promptId)}, ${optionalThirdVar}, 'OPTIONAL', 3, 1)` +
      ` ON DUPLICATE KEY UPDATE display_order = VALUES(display_order), is_active = VALUES(is_active);`,
    `INSERT INTO prompt_task_profile_slots (prompt_id, slot_id, slot_role, display_order, is_active)` +
      ` VALUES (${sql(promptId)}, ${optionalFourthVar}, 'OPTIONAL', 4, 1)` +
      ` ON DUPLICATE KEY UPDATE display_order = VALUES(display_order), is_active = VALUES(is_active);`,
  ];
}

function validate() {
  const ids = new Set();
  const normalizedQuestions = new Set();

  for (const pack of allPacks) {
    if (pack.words.length !== 10) {
      throw new Error(`${pack.detailName} must have exactly 10 vocab words.`);
    }
    if (pack.phrases.length !== 5) {
      throw new Error(`${pack.detailName} must have exactly 5 vocab phrases.`);
    }
    if (pack.prompts.length !== 15) {
      throw new Error(`${pack.detailName} must have exactly 15 prompts.`);
    }

    for (const prompt of pack.prompts) {
      if (ids.has(prompt.id)) {
        throw new Error(`Duplicate prompt id detected: ${prompt.id}`);
      }
      ids.add(prompt.id);

      const normalized = prompt.questionEn.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (normalizedQuestions.has(normalized)) {
        throw new Error(`Duplicate prompt question detected: ${prompt.questionEn}`);
      }
      normalizedQuestions.add(normalized);
    }
  }

  const promptCount = allPacks.reduce((sum, pack) => sum + pack.prompts.length, 0);
  if (promptCount !== 150) {
    throw new Error(`Expected 150 prompts but found ${promptCount}.`);
  }
}

function generateSql() {
  validate();

  const lines = [];
  lines.push("-- Seed 150 additional intro prompts with full hint and task metadata.");
  lines.push("-- Generated by tools/prompt-seed/generate_additional_intro_prompt_migration.mjs");
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

  lines.push("-- Ensure answer mode rows exist.");
  for (const mode of answerModes) {
    lines.push(
      `INSERT INTO prompt_answer_modes (code, display_order, is_active) VALUES (${sql(mode.code)}, ${mode.displayOrder}, 1)` +
        ` ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), display_order = VALUES(display_order), is_active = VALUES(is_active);`
    );
    lines.push(`SET ${mode.variable} = LAST_INSERT_ID();`);
  }
  lines.push("");

  lines.push("-- Ensure task slot rows exist.");
  for (const slot of taskSlots) {
    lines.push(
      `INSERT INTO prompt_task_slots (code, display_order, is_active) VALUES (${sql(slot.code)}, ${slot.displayOrder}, 1)` +
        ` ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), display_order = VALUES(display_order), is_active = VALUES(is_active);`
    );
    lines.push(`SET ${slot.variable} = LAST_INSERT_ID();`);
  }
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
      lines.push(...buildHintRows(prompt, pack.family, pack.words, pack.phrases));
      lines.push(...buildTaskMetaRows(prompt.id, pack.family));
      displayOrder += 1;
    }
    lines.push("");
  }

  lines.push("COMMIT;");
  lines.push("");
  return lines.join("\n");
}

const sqlText = generateSql();
fs.mkdirSync(path.dirname(OUTPUT_SQL), { recursive: true });
fs.writeFileSync(OUTPUT_SQL, sqlText, "utf8");
console.log(`Generated 150 intro prompts into ${OUTPUT_SQL}`);
