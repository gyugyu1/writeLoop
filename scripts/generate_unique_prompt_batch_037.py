from __future__ import annotations

import argparse
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

import pymysql


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "infra" / "mysql" / "schema" / "037-seed-214-unique-prompts.sql"
ENV_PATH = ROOT / ".env"

ANSWER_MODE_IDS = {
    "ROUTINE": 1,
    "PREFERENCE": 2,
    "GOAL_PLAN": 3,
    "PROBLEM_SOLUTION": 4,
    "BALANCED_OPINION": 5,
    "OPINION_REASON": 6,
    "CHANGE_REFLECTION": 7,
    "GENERAL_DESCRIPTION": 8,
}

SLOT_IDS = {
    "MAIN_ANSWER": 1,
    "REASON": 2,
    "EXAMPLE": 3,
    "FEELING": 4,
    "ACTIVITY": 5,
    "TIME_OR_PLACE": 6,
}

CATEGORY_ORDER = [
    "routine",
    "preference",
    "goal",
    "problem",
    "balance",
    "opinion",
    "reflection",
    "general",
]


def word(content: str, meaning_ko: str, example_en: str, family: str) -> dict[str, str]:
    return {
        "item_type": "WORD",
        "content": content,
        "meaning_ko": meaning_ko,
        "example_en": example_en,
        "expression_family": family,
    }


def phrase(content: str, meaning_ko: str, example_en: str, family: str) -> dict[str, str]:
    return {
        "item_type": "PHRASE",
        "content": content,
        "meaning_ko": meaning_ko,
        "example_en": example_en,
        "expression_family": family,
    }


def frame(content: str, meaning_ko: str, usage_tip_ko: str, example_en: str, family: str) -> dict[str, str]:
    return {
        "item_type": "FRAME",
        "content": content,
        "meaning_ko": meaning_ko,
        "usage_tip_ko": usage_tip_ko,
        "example_en": example_en,
        "expression_family": family,
    }


ROUTINE_TOPICS = [
    ("Laundry Day at Home", "집에서 빨래하는 날", "on laundry day at home", "집에서 빨래하는 날"),
    ("Before an Early Appointment", "이른 약속이 있기 전", "before an early appointment", "이른 약속이 있기 전"),
    ("After Grocery Shopping", "장을 보고 돌아온 뒤", "after grocery shopping", "장을 보고 돌아온 뒤"),
    ("While Waiting for Class", "수업이 시작되길 기다릴 때", "while waiting for class to begin", "수업이 시작되길 기다릴 때"),
    ("Your First Hour at Work", "출근 후 첫 한 시간", "during your first hour at work", "출근 후 첫 한 시간 동안"),
    ("Quiet Sunday Evening", "조용한 일요일 저녁", "on a quiet Sunday evening", "조용한 일요일 저녁에"),
    ("Before Meeting Friends", "친구들과 저녁 약속 전에", "before meeting friends for dinner", "친구들과 저녁 약속 전에"),
    ("After a Workout", "운동을 마친 뒤", "after finishing a workout", "운동을 마친 뒤"),
    ("Long Train Ride", "긴 기차 이동 중", "during a long train ride", "긴 기차 이동 중에"),
    ("Indoor Rest Day", "집에서 쉬는 날", "on a day when you stay indoors", "집에서 쉬는 날"),
    ("Exam Preparation Breaks", "시험 준비 중", "while preparing for an exam", "시험을 준비할 때"),
    ("After a Late Lunch", "늦은 점심을 먹은 뒤", "after a late lunch", "늦은 점심을 먹은 뒤"),
    ("Room Cleaning Time", "방을 청소할 때", "when you clean your room", "방을 청소할 때"),
    ("Friday Night at Home", "금요일 밤 집에서", "on Friday night at home", "금요일 밤 집에서"),
    ("Before a Family Outing", "가족과 외출하기 전에", "before a family outing", "가족과 외출하기 전에"),
    ("Weekend Evening", "주말 저녁 시간", "during your weekend evening", "주말 저녁 시간에"),
    ("Arriving Too Early", "어딘가에 너무 일찍 도착했을 때", "when you arrive somewhere too early", "어딘가에 너무 일찍 도착했을 때"),
    ("After a Shopping Trip", "쇼핑을 마치고 돌아온 뒤", "after coming back from a shopping trip", "쇼핑을 마치고 돌아온 뒤"),
    ("Before Leaving for School", "학교에 가기 전에", "before leaving for school", "학교에 가기 전에"),
    ("Solo Subway Ride", "혼자 지하철을 탈 때", "while riding the subway alone", "혼자 지하철을 탈 때"),
    ("After Household Chores", "집안일을 끝낸 뒤", "after finishing household chores", "집안일을 끝낸 뒤"),
    ("Rainy Morning Indoors", "비 오는 아침 집 안에서", "on a rainy morning indoors", "비 오는 아침 집 안에서"),
    ("Before a Side Project", "개인 프로젝트를 시작하기 전에", "before starting a side project", "개인 프로젝트를 시작하기 전에"),
    ("Waiting at the Airport", "공항에서 기다릴 때", "while waiting at the airport", "공항에서 기다릴 때"),
    ("After a Short Nap", "짧게 낮잠을 잔 뒤", "after taking a short nap", "짧게 낮잠을 잔 뒤"),
    ("Campus Break Time", "캠퍼스에서 쉬는 시간", "during a break on campus", "캠퍼스에서 쉬는 시간에"),
    ("Before Recording a Video", "영상을 찍기 전에", "before recording a video for yourself or class", "수업이나 개인용 영상을 찍기 전에"),
]

PREFERENCE_TOPICS = [
    ("Weekday Breakfast Menu", "평일 아침 메뉴", "weekday breakfast menu", "평일 아침 메뉴"),
    ("Summer Fruit", "여름에 먹는 과일", "summer fruit", "여름에 먹는 과일"),
    ("Rainy Day Drink", "비 오는 날 마시는 음료", "rainy-day drink", "비 오는 날 마시는 음료"),
    ("Phone Case Style", "휴대폰 케이스 스타일", "phone case style", "휴대폰 케이스 스타일"),
    ("Notebook Type", "좋아하는 노트 종류", "notebook type", "좋아하는 노트 종류"),
    ("Place to Read", "책 읽기 좋은 장소", "place to read", "책 읽기 좋은 장소"),
    ("Kind of Soup", "좋아하는 수프 종류", "kind of soup", "좋아하는 수프 종류"),
    ("Type of Bag", "자주 드는 가방 종류", "type of bag", "자주 드는 가방 종류"),
    ("Board Game", "좋아하는 보드게임", "board game", "좋아하는 보드게임"),
    ("Way to Study Vocabulary", "단어 공부하는 방식", "way to study vocabulary", "단어 공부하는 방식"),
    ("Flower Scent", "좋아하는 꽃 향", "flower scent", "좋아하는 꽃 향"),
    ("Seat on the Bus", "버스에서 선호하는 자리", "seat on the bus", "버스에서 선호하는 자리"),
    ("Weather for Walking", "산책하기 좋은 날씨", "kind of weather for walking", "산책하기 좋은 날씨"),
    ("Type of Sandwich", "좋아하는 샌드위치 종류", "type of sandwich", "좋아하는 샌드위치 종류"),
    ("Kitchen Tool", "가장 자주 쓰는 주방 도구", "kitchen tool", "가장 자주 쓰는 주방 도구"),
    ("Exercise Class", "좋아하는 운동 수업 형태", "kind of exercise class", "좋아하는 운동 수업 형태"),
    ("Online Creator", "자주 보는 온라인 크리에이터", "online creator", "자주 보는 온라인 크리에이터"),
    ("Break Time Snack", "쉬는 시간에 먹는 간식", "snack for work or study breaks", "쉬는 시간에 먹는 간식"),
    ("Type of Pen", "좋아하는 펜 종류", "type of pen", "좋아하는 펜 종류"),
    ("Bakery Item", "베이커리에서 가장 좋아하는 메뉴", "bakery item", "베이커리에서 가장 좋아하는 메뉴"),
    ("Movie Snack", "영화 볼 때 먹는 간식", "movie snack", "영화 볼 때 먹는 간식"),
    ("Travel Souvenir", "좋아하는 여행 기념품", "travel souvenir", "좋아하는 여행 기념품"),
    ("Candle Scent", "좋아하는 캔들 향", "candle scent", "좋아하는 캔들 향"),
    ("Way to Organize Photos", "사진 정리하는 방식", "way to organize photos", "사진 정리하는 방식"),
    ("Kind of Tea", "좋아하는 차 종류", "kind of tea", "좋아하는 차 종류"),
    ("Light Jacket", "좋아하는 가벼운 겉옷", "light jacket", "좋아하는 가벼운 겉옷"),
]

GOAL_TOPICS = [
    ("Sleep Schedule", "수면 습관을 더 일정하게 만드는 것", "improving your sleep schedule", "수면 습관을 더 일정하게 만드는 것"),
    ("Daily Journal", "매일 짧게 일기를 쓰는 것", "keeping a daily journal", "매일 짧게 일기를 쓰는 것"),
    ("Simple Cooking", "간단한 요리를 스스로 할 수 있게 되는 것", "learning to cook simple meals", "간단한 요리를 스스로 할 수 있게 되는 것"),
    ("Digital File Organization", "디지털 파일을 정리하는 것", "organizing your digital files", "디지털 파일을 정리하는 것"),
    ("Meeting Confidence", "회의에서 더 자신 있게 말하는 것", "speaking more confidently in meetings", "회의에서 더 자신 있게 말하는 것"),
    ("Night Screen Limit", "밤에 화면 보는 시간을 줄이는 것", "limiting screen time at night", "밤에 화면 보는 시간을 줄이는 것"),
    ("Photography Practice", "사진 촬영을 꾸준히 연습하는 것", "practicing photography regularly", "사진 촬영을 꾸준히 연습하는 것"),
    ("Meal Prep Habit", "주간 식사를 미리 준비하는 것", "preparing weekly meals in advance", "주간 식사를 미리 준비하는 것"),
    ("Long Article Reading", "매주 긴 글 한 편을 읽는 것", "reading one long article each week", "매주 긴 글 한 편을 읽는 것"),
    ("Stretching Habit", "스트레칭 습관을 만드는 것", "building a better stretching habit", "스트레칭 습관을 만드는 것"),
    ("Note Taking System", "노트 정리 방식을 개선하는 것", "improving your note-taking system", "노트 정리 방식을 개선하는 것"),
    ("On Time Housework", "집안일을 제때 끝내는 것", "finishing household tasks on time", "집안일을 제때 끝내는 것"),
    ("Calmer Mornings", "아침 시간을 더 차분하게 보내는 것", "making your mornings calmer", "아침 시간을 더 차분하게 보내는 것"),
    ("Clearer Questions", "수업에서 더 분명하게 질문하는 것", "asking clearer questions in class", "수업에서 더 분명하게 질문하는 것"),
    ("Basic Design Skill", "기초 디자인 감각을 익히는 것", "learning basic design skills", "기초 디자인 감각을 익히는 것"),
    ("Reduce Food Waste", "집에서 음식 낭비를 줄이는 것", "reducing food waste at home", "집에서 음식 낭비를 줄이는 것"),
    ("Weekly Review Habit", "한 주를 돌아보는 습관을 만드는 것", "building a habit of reviewing your week", "한 주를 돌아보는 습관을 만드는 것"),
    ("Map Reading Skill", "지도를 더 잘 읽는 것", "becoming better at map reading", "지도를 더 잘 읽는 것"),
    ("Weekend Reset Routine", "주말 리셋 루틴을 만드는 것", "building a weekend reset routine", "주말 리셋 루틴을 만드는 것"),
    ("Simple Repair Skills", "간단한 수리 기술을 익히는 것", "learning simple repair skills", "간단한 수리 기술을 익히는 것"),
    ("Clear Desk Habit", "책상을 늘 정돈된 상태로 유지하는 것", "keeping your desk clear", "책상을 늘 정돈된 상태로 유지하는 것"),
    ("Remembering Names", "사람 이름을 더 잘 기억하는 것", "remembering names more easily", "사람 이름을 더 잘 기억하는 것"),
    ("Listening Patience", "상대 말을 끝까지 듣는 습관을 기르는 것", "improving your listening patience", "상대 말을 끝까지 듣는 습관을 기르는 것"),
    ("Plant Care", "식물을 더 잘 돌보는 것", "taking better care of plants", "식물을 더 잘 돌보는 것"),
    ("Using Small Pockets of Time", "짧은 자투리 시간을 더 잘 활용하는 것", "making better use of small pockets of time", "짧은 자투리 시간을 더 잘 활용하는 것"),
    ("Realistic To Do Lists", "더 현실적인 할 일 목록을 세우는 것", "planning more realistic to-do lists", "더 현실적인 할 일 목록을 세우는 것"),
    ("Rest Without Guilt", "죄책감 없이 쉬는 법을 배우는 것", "learning to rest without guilt", "죄책감 없이 쉬는 법을 배우는 것"),
]

PROBLEM_TOPICS = [
    ("Noisy Places", "시끄러운 환경을 견디는 것", "dealing with noisy places", "시끄러운 환경을 견디는 것"),
    ("Inbox Control", "메일함을 정리하는 것", "keeping your inbox under control", "메일함을 정리하는 것"),
    ("Asking When Confused", "헷갈릴 때 질문하는 것", "asking questions when confused", "헷갈릴 때 질문하는 것"),
    ("Recovering After a Bad Day", "기분이 좋지 않은 날 다시 회복하는 것", "recovering after a bad day", "기분이 좋지 않은 날 다시 회복하는 것"),
    ("Choosing What Comes First", "무엇부터 할지 정하는 것", "choosing what to do first", "무엇부터 할지 정하는 것"),
    ("Starting Small Tasks", "작은 일을 바로 시작하는 것", "starting small tasks right away", "작은 일을 바로 시작하는 것"),
    ("Speaking While Nervous", "긴장할 때 말하는 것", "speaking when you feel nervous", "긴장할 때 말하는 것"),
    ("Commuting Delays", "이동 지연에 대처하는 것", "handling commuting delays", "이동 지연에 대처하는 것"),
    ("Too Many Open Tabs", "열린 화면이 너무 많을 때 정리하는 것", "managing too many open tabs", "열린 화면이 너무 많을 때 정리하는 것"),
    ("Remembering Peoples Names", "사람 이름을 기억하는 것", "remembering people's names", "사람 이름을 기억하는 것"),
    ("Staying Calm During Conflict", "갈등 상황에서 침착함을 유지하는 것", "staying calm during conflict", "갈등 상황에서 침착함을 유지하는 것"),
    ("Minor Tech Issues", "사소한 기기 문제를 해결하는 것", "fixing minor tech issues", "사소한 기기 문제를 해결하는 것"),
    ("Sharing Unfinished Work", "덜 끝난 작업을 먼저 공유하는 것", "sharing unfinished work early", "덜 끝난 작업을 먼저 공유하는 것"),
    ("Sleepy Morning", "졸린 아침을 버티는 것", "getting through a sleepy morning", "졸린 아침을 버티는 것"),
    ("Overplanning the Weekend", "주말 계획을 과하게 세우지 않는 것", "avoiding overplanning your weekend", "주말 계획을 과하게 세우지 않는 것"),
    ("Handling Slow Progress", "진도가 느릴 때 버티는 것", "handling slow progress", "진도가 느릴 때 버티는 것"),
    ("Comparison With Others", "남과 비교하지 않는 것", "not comparing yourself to others", "남과 비교하지 않는 것"),
    ("Balancing Hobbies and Chores", "취미와 집안일의 균형을 잡는 것", "balancing hobbies and chores", "취미와 집안일의 균형을 잡는 것"),
    ("Saying No Politely", "정중하게 거절하는 것", "saying no politely", "정중하게 거절하는 것"),
    ("Restarting a Routine", "루틴을 놓친 뒤 다시 시작하는 것", "restarting after missing a routine", "루틴을 놓친 뒤 다시 시작하는 것"),
    ("Reading Long Articles", "긴 글을 끝까지 읽는 것", "reading long articles without losing focus", "긴 글을 끝까지 읽는 것"),
    ("Keeping a Desk Organized", "책상을 정리된 상태로 두는 것", "keeping your desk organized", "책상을 정리된 상태로 두는 것"),
    ("Crowded Spaces", "붐비는 공간에서 지내는 것", "dealing with crowded spaces", "붐비는 공간에서 지내는 것"),
    ("Distracting Messages", "방해되는 메시지를 무시하는 것", "ignoring distracting messages", "방해되는 메시지를 무시하는 것"),
    ("Summarizing Ideas Clearly", "생각을 짧고 분명하게 정리하는 것", "summarizing your ideas clearly", "생각을 짧고 분명하게 정리하는 것"),
    ("Following Instructions", "한 번에 지시를 제대로 이해하는 것", "following instructions the first time", "한 번에 지시를 제대로 이해하는 것"),
    ("Patience in Long Lines", "줄이 길 때 참는 것", "staying patient in slow lines", "줄이 길 때 참는 것"),
]

BALANCE_TOPICS = [
    ("Self Checkout Kiosks", "무인 계산대", "self-checkout kiosks", "무인 계산대"),
    ("Open Plan Offices", "개방형 사무실", "open-plan offices", "개방형 사무실"),
    ("Reusable Packaging Rules", "재사용 포장 규칙", "reusable packaging rules", "재사용 포장 규칙"),
    ("Subscription Services", "구독 서비스", "subscription services", "구독 서비스"),
    ("Online Petitions", "온라인 청원", "online petitions", "온라인 청원"),
    ("Smart Home Devices", "스마트 홈 기기", "smart home devices", "스마트 홈 기기"),
    ("School Rankings", "학교 순위 공개", "school rankings", "학교 순위 공개"),
    ("Cashless School Cafeterias", "현금 없는 학교 매점", "cashless school cafeterias", "현금 없는 학교 매점"),
    ("Pet Friendly Offices", "반려동물 동반 사무실", "pet-friendly offices", "반려동물 동반 사무실"),
    ("Tourist Taxes", "관광세", "tourist taxes", "관광세"),
    ("Digital Textbooks", "디지털 교과서", "digital textbooks", "디지털 교과서"),
    ("Neighborhood Security Cameras", "동네 보안 카메라", "neighborhood security cameras", "동네 보안 카메라"),
    ("Food Expiration Labels", "식품 유통기한 표시 방식", "food expiration labels", "식품 유통기한 표시 방식"),
    ("AI Customer Service", "AI 고객 응대", "AI customer service", "AI 고객 응대"),
    ("Bicycle Sharing Systems", "공유 자전거 시스템", "bicycle sharing systems", "공유 자전거 시스템"),
    ("Coworking Spaces", "코워킹 스페이스", "coworking spaces", "코워킹 스페이스"),
    ("Four Day Workweeks", "주 4일 근무제", "four-day workweeks", "주 4일 근무제"),
    ("Location Sharing Among Friends", "친구 사이 위치 공유", "location sharing among friends", "친구 사이 위치 공유"),
    ("Electric Scooters in Cities", "도심 전동 킥보드", "electric scooters in cities", "도심 전동 킥보드"),
    ("Live Stream Shopping", "라이브 커머스", "live-stream shopping", "라이브 커머스"),
    ("Reusable Cup Deposit Programs", "다회용 컵 보증금 제도", "reusable cup deposit programs", "다회용 컵 보증금 제도"),
    ("Translation Apps for Travel", "여행용 번역 앱", "translation apps for travel", "여행용 번역 앱"),
    ("Meal Kit Services", "밀키트 서비스", "meal kit services", "밀키트 서비스"),
    ("Personal Data Rewards Programs", "개인정보 보상 프로그램", "personal data rewards programs", "개인정보 보상 프로그램"),
    ("Automated Attendance Systems", "자동 출결 시스템", "automated attendance systems", "자동 출결 시스템"),
    ("Office Hot Desking", "고정 좌석 없는 사무실", "office hot-desking", "고정 좌석 없는 사무실"),
    ("Second Screen Viewing Habits", "영상을 보며 다른 화면을 함께 쓰는 습관", "second-screen viewing habits", "영상을 보며 다른 화면을 함께 쓰는 습관"),
]

OPINION_TOPICS = [
    ("Neighborhood Parks", "동네 공원", "neighborhood parks", "동네 공원"),
    ("Public Museums", "공공 박물관", "public museums", "공공 박물관"),
    ("Local Bookstores", "동네 서점", "local bookstores", "동네 서점"),
    ("Universities", "대학교", "universities", "대학교"),
    ("Local News Outlets", "지역 뉴스 매체", "local news outlets", "지역 뉴스 매체"),
    ("Convenience Stores", "편의점", "convenience stores", "편의점"),
    ("Sports Clubs for Teenagers", "청소년 스포츠 클럽", "sports clubs for teenagers", "청소년 스포츠 클럽"),
    ("Public Health Campaigns", "공공 보건 캠페인", "public health campaigns", "공공 보건 캠페인"),
    ("Companies Using AI", "AI를 활용하는 기업", "companies using AI", "AI를 활용하는 기업"),
    ("Animal Shelters", "동물 보호소", "animal shelters", "동물 보호소"),
    ("Public Broadcasters", "공영 방송", "public broadcasters", "공영 방송"),
    ("Community Centers", "주민 센터", "community centers", "주민 센터"),
    ("Local Farmers Markets", "지역 농산물 시장", "local farmers' markets", "지역 농산물 시장"),
    ("After School Programs", "방과 후 프로그램", "after-school programs", "방과 후 프로그램"),
    ("Train Stations", "기차역", "train stations", "기차역"),
    ("City Bike Systems", "공공 자전거 시스템", "city bike systems", "공공 자전거 시스템"),
    ("Employers Offering Internships", "인턴십을 제공하는 기업", "employers offering internships", "인턴십을 제공하는 기업"),
    ("Restaurants Reducing Food Waste", "음식물 쓰레기를 줄이려는 식당", "restaurants reducing food waste", "음식물 쓰레기를 줄이려는 식당"),
    ("Schools Teaching Online Safety", "온라인 안전을 가르치는 학교", "schools teaching online safety", "온라인 안전을 가르치는 학교"),
    ("Heat Shelter Programs", "폭염 쉼터를 운영하는 지방자치단체", "local governments running heat shelters", "폭염 쉼터를 운영하는 지방자치단체"),
    ("Cultural Festivals", "문화 축제", "cultural festivals", "문화 축제"),
    ("Volunteer Matching Platforms", "봉사활동 연결 플랫폼", "volunteer matching platforms", "봉사활동 연결 플랫폼"),
    ("Apartment Recycling Rooms", "아파트 분리수거 공간", "apartment recycling rooms", "아파트 분리수거 공간"),
    ("Community Gardens", "공동체 정원", "community gardens", "공동체 정원"),
    ("Senior Centers", "노인 복지관", "senior centers", "노인 복지관"),
    ("Public Swimming Pools", "공공 수영장", "public swimming pools", "공공 수영장"),
    ("Neighborhood Clinics", "동네 의원", "neighborhood clinics", "동네 의원"),
]

REFLECTION_TOPICS = [
    ("Competition", "경쟁", "competition", "경쟁"),
    ("Taking Breaks", "쉬는 것", "taking breaks", "쉬는 것"),
    ("Living Alone", "혼자 사는 것", "living alone", "혼자 사는 것"),
    ("Networking", "인맥 만들기", "networking", "인맥 만들기"),
    ("Small Talk", "가벼운 대화", "small talk", "가벼운 대화"),
    ("Asking for Help", "도움 요청", "asking for help", "도움 요청"),
    ("Productivity", "생산성", "productivity", "생산성"),
    ("Boredom", "지루함", "boredom", "지루함"),
    ("Fashion", "옷차림", "fashion", "옷차림"),
    ("Time Spent Alone", "혼자 보내는 시간", "time spent alone", "혼자 보내는 시간"),
    ("Exercise", "운동", "exercise", "운동"),
    ("Online Classes", "온라인 수업", "online classes", "온라인 수업"),
    ("Keeping a Diary", "일기 쓰기", "keeping a diary", "일기 쓰기"),
    ("Neighborhood Life", "동네 생활", "neighborhood life", "동네 생활"),
    ("Routines", "루틴", "routines", "루틴"),
    ("Mistakes", "실수", "mistakes", "실수"),
    ("Receiving Feedback", "피드백 받기", "receiving feedback", "피드백 받기"),
    ("Spending Weekends", "주말 보내는 방식", "spending weekends", "주말 보내는 방식"),
    ("Owning Fewer Things", "물건을 적게 갖는 삶", "owning fewer things", "물건을 적게 갖는 삶"),
    ("Being Punctual", "시간 약속", "being punctual", "시간 약속"),
    ("Teamwork", "팀워크", "teamwork", "팀워크"),
    ("Privacy", "사생활", "privacy", "사생활"),
    ("Living Close to Work or School", "직장이나 학교 가까이에 사는 것", "living close to work or school", "직장이나 학교 가까이에 사는 것"),
    ("Cooking at Home", "집에서 요리하는 것", "cooking at home", "집에서 요리하는 것"),
    ("Public Speaking", "사람들 앞에서 말하는 것", "public speaking", "사람들 앞에서 말하는 것"),
    ("Part Time Jobs", "아르바이트", "part-time jobs", "아르바이트"),
    ("Planning Ahead", "미리 계획하는 것", "planning ahead", "미리 계획하는 것"),
]

GENERAL_TOPICS = [
    ("Neighborhood Festival", "좋아하는 동네 축제", "a neighborhood festival you enjoy", "좋아하는 동네 축제"),
    ("Small Desk Item", "매일 쓰는 작은 책상 위 물건", "a small desk item you use every day", "매일 쓰는 작은 책상 위 물건"),
    ("Bus Route", "익숙한 버스 노선", "a bus route you know well", "익숙한 버스 노선"),
    ("Keepsake Gift", "아직 간직하고 있는 선물", "a gift you still keep", "아직 간직하고 있는 선물"),
    ("Favorite Corner of Your Room", "마음에 드는 방 한쪽 공간", "a corner of your room you like", "마음에 드는 방 한쪽 공간"),
    ("Local Bridge or Walkway", "자주 건너는 동네 다리나 길", "a local bridge or walkway you like crossing", "자주 건너는 동네 다리나 길"),
    ("Study Playlist", "공부할 때 듣는 플레이리스트", "a playlist you use for studying", "공부할 때 듣는 플레이리스트"),
    ("Meal You Learned to Cook", "스스로 배워 만든 요리", "a meal you learned to cook yourself", "스스로 배워 만든 요리"),
    ("Cafe You Revisit", "자주 다시 가는 카페", "a cafe you revisit often", "자주 다시 가는 카페"),
    ("Family Photo", "오래 기억에 남는 가족 사진", "a family photo you remember well", "오래 기억에 남는 가족 사진"),
    ("Useful Phone Feature", "자주 의지하는 휴대폰 기능", "a phone feature you rely on", "자주 의지하는 휴대폰 기능"),
    ("Notebook You Carry", "들고 다니는 노트", "a notebook you carry around", "들고 다니는 노트"),
    ("Desk Object", "늘 책상 위에 있는 물건", "an object that stays on your desk", "늘 책상 위에 있는 물건"),
    ("Volunteer Event", "참여해 본 봉사활동", "a volunteer event you joined", "참여해 본 봉사활동"),
    ("Favorite Discussion Topic", "이야기하기 좋아하는 주제", "a topic you enjoy talking about", "이야기하기 좋아하는 주제"),
    ("Old Jacket or Coat", "아직 입는 오래된 겉옷", "an old jacket or coat you still wear", "아직 입는 오래된 겉옷"),
    ("Market Stall", "가기 좋아하는 시장 가판대", "a market stall you like visiting", "가기 좋아하는 시장 가판대"),
    ("Rainy Day Sound", "비 오는 날 좋아하는 소리", "a rainy-day sound you like", "비 오는 날 좋아하는 소리"),
    ("Window View", "기억에 남는 창밖 풍경", "a view from a window you remember", "기억에 남는 창밖 풍경"),
    ("Community Class", "도움이 되었던 지역 수업", "a community class you found useful", "도움이 되었던 지역 수업"),
    ("Plant You Care For", "직접 돌보는 식물", "a plant you take care of", "직접 돌보는 식물"),
    ("Childhood Snack", "아직 좋아하는 어린 시절 간식", "a childhood snack you still like", "아직 좋아하는 어린 시절 간식"),
    ("Nearby River Path", "잘 아는 강변길이나 골목길", "a nearby river path or street you know well", "잘 아는 강변길이나 골목길"),
    ("Recipe from Home", "집에서 자주 먹던 레시피", "a recipe from your home", "집에서 자주 먹던 레시피"),
    ("Second Hand Item", "중고로 산 물건", "a second-hand item you bought", "중고로 산 물건"),
    ("Neighborhood Shortcut", "동네에서 자주 쓰는 지름길", "a shortcut in your neighborhood", "동네에서 자주 쓰는 지름길"),
]


TOPICS = {
    "routine": ROUTINE_TOPICS,
    "preference": PREFERENCE_TOPICS,
    "goal": GOAL_TOPICS,
    "problem": PROBLEM_TOPICS,
    "balance": BALANCE_TOPICS,
    "opinion": OPINION_TOPICS,
    "reflection": REFLECTION_TOPICS,
    "general": GENERAL_TOPICS,
}


CATEGORY_WORD_BANKS = {
    "routine": [
        word("routine", "루틴", "A simple routine helps me stay steady.", "ROUTINE_BANK"),
        word("habit", "습관", "This habit makes my day smoother.", "ROUTINE_BANK"),
        word("prepare", "준비하다", "I prepare a few things in advance.", "ROUTINE_BANK"),
        word("organize", "정리하다", "I organize my space before I begin.", "ROUTINE_BANK"),
        word("pause", "잠깐 멈춤", "A short pause helps me reset.", "ROUTINE_BANK"),
        word("quiet", "조용한", "I like a quiet moment before the next task.", "ROUTINE_BANK"),
        word("steady", "꾸준한", "A steady routine feels reliable.", "ROUTINE_BANK"),
        word("unwind", "긴장을 풀다", "This is how I unwind after a long day.", "ROUTINE_BANK"),
        word("settle", "차분해지다", "I take time to settle into the moment.", "ROUTINE_BANK"),
        word("timing", "타이밍", "Good timing makes the routine easier.", "ROUTINE_BANK"),
        word("sequence", "순서", "The sequence helps me remember what to do.", "ROUTINE_BANK"),
        word("refresh", "기분을 새롭게 하다", "A short break can refresh my mind.", "ROUTINE_BANK"),
    ],
    "preference": [
        word("favorite", "가장 좋아하는", "This is still my favorite choice.", "PREFERENCE_BANK"),
        word("flavor", "맛", "The flavor is simple but memorable.", "PREFERENCE_BANK"),
        word("texture", "식감", "The texture makes it more enjoyable.", "PREFERENCE_BANK"),
        word("comfort", "편안함", "It gives me a sense of comfort.", "PREFERENCE_BANK"),
        word("style", "스타일", "I like its clean style.", "PREFERENCE_BANK"),
        word("mood", "기분", "It matches my mood well.", "PREFERENCE_BANK"),
        word("appealing", "매력적인", "Something about it feels especially appealing.", "PREFERENCE_BANK"),
        word("classic", "익숙한", "It feels like a classic choice for me.", "PREFERENCE_BANK"),
        word("reliable", "믿을 만한", "I keep choosing it because it feels reliable.", "PREFERENCE_BANK"),
        word("simple", "단순한", "Its simple charm is the main reason I like it.", "PREFERENCE_BANK"),
        word("memorable", "기억에 남는", "Even small details make it memorable.", "PREFERENCE_BANK"),
        word("pleasant", "기분 좋은", "It leaves a pleasant impression.", "PREFERENCE_BANK"),
    ],
    "goal": [
        word("goal", "목표", "This goal feels realistic for me.", "GOAL_BANK"),
        word("plan", "계획", "A clear plan helps me stay calm.", "GOAL_BANK"),
        word("progress", "진전", "Small progress keeps me motivated.", "GOAL_BANK"),
        word("practice", "연습", "Practice matters more than speed.", "GOAL_BANK"),
        word("consistency", "꾸준함", "Consistency is the hardest part for me.", "GOAL_BANK"),
        word("focus", "집중", "I need more focus than motivation.", "GOAL_BANK"),
        word("milestone", "중간 목표", "A milestone helps me track my effort.", "GOAL_BANK"),
        word("routine", "루틴", "I want to turn this into a routine.", "GOAL_BANK"),
        word("commitment", "의지", "It takes commitment to keep going.", "GOAL_BANK"),
        word("steady", "꾸준한", "Steady effort works better than short bursts.", "GOAL_BANK"),
        word("review", "점검", "A weekly review helps me adjust my plan.", "GOAL_BANK"),
        word("habit", "습관", "A good habit makes the goal easier to keep.", "GOAL_BANK"),
    ],
    "problem": [
        word("challenge", "어려움", "This challenge shows up more often than I expect.", "PROBLEM_BANK"),
        word("obstacle", "장애물", "It feels like a small obstacle at first.", "PROBLEM_BANK"),
        word("strategy", "전략", "A simple strategy helps me respond faster.", "PROBLEM_BANK"),
        word("solution", "해결책", "I am still testing the best solution.", "PROBLEM_BANK"),
        word("adjust", "조정하다", "I need to adjust my approach each time.", "PROBLEM_BANK"),
        word("recover", "회복하다", "It takes a little time to recover from it.", "PROBLEM_BANK"),
        word("pressure", "압박감", "The pressure gets stronger when I rush.", "PROBLEM_BANK"),
        word("manage", "관리하다", "I am learning how to manage it better.", "PROBLEM_BANK"),
        word("setback", "차질", "A small setback can affect the whole day.", "PROBLEM_BANK"),
        word("patience", "인내", "Patience matters more than I expected.", "PROBLEM_BANK"),
        word("support", "도움", "Sometimes outside support makes a difference.", "PROBLEM_BANK"),
        word("rethink", "다시 생각하다", "I often need to rethink my first reaction.", "PROBLEM_BANK"),
    ],
    "balance": [
        word("benefit", "장점", "The benefit is clear in daily life.", "BALANCE_BANK"),
        word("drawback", "단점", "A drawback appears when people depend on it too much.", "BALANCE_BANK"),
        word("impact", "영향", "Its impact is stronger than it first seems.", "BALANCE_BANK"),
        word("convenience", "편리함", "Convenience is one major reason people like it.", "BALANCE_BANK"),
        word("risk", "위험", "There is also some risk that people ignore.", "BALANCE_BANK"),
        word("access", "접근성", "Access becomes easier for more people.", "BALANCE_BANK"),
        word("balance", "균형", "The key issue is finding the right balance.", "BALANCE_BANK"),
        word("efficiency", "효율", "It can improve efficiency in some situations.", "BALANCE_BANK"),
        word("fairness", "공정성", "People also care about fairness.", "BALANCE_BANK"),
        word("dependence", "의존", "Too much dependence can become a problem.", "BALANCE_BANK"),
        word("flexibility", "유연성", "Flexibility matters when needs are different.", "BALANCE_BANK"),
        word("tradeoff", "상충 관계", "Every choice involves some tradeoff.", "BALANCE_BANK"),
    ],
    "opinion": [
        word("responsibility", "책임", "I think responsibility should come first.", "OPINION_BANK"),
        word("community", "공동체", "The community benefits when people can rely on it.", "OPINION_BANK"),
        word("support", "지원", "Support should reach the people who need it most.", "OPINION_BANK"),
        word("access", "접근성", "Better access can improve daily life.", "OPINION_BANK"),
        word("fairness", "공정성", "Fairness matters in any public role.", "OPINION_BANK"),
        word("education", "교육", "Education is one lasting way to help people.", "OPINION_BANK"),
        word("trust", "신뢰", "Trust grows when the role is clear.", "OPINION_BANK"),
        word("resource", "자원", "Good resources make long-term support possible.", "OPINION_BANK"),
        word("protection", "보호", "Protection is part of good public support.", "OPINION_BANK"),
        word("participation", "참여", "Participation becomes easier when people feel welcome.", "OPINION_BANK"),
        word("opportunity", "기회", "The right role can create new opportunities.", "OPINION_BANK"),
        word("care", "돌봄", "People notice the difference when care is practical.", "OPINION_BANK"),
    ],
    "reflection": [
        word("change", "변화", "The change happened gradually.", "REFLECTION_BANK"),
        word("perspective", "관점", "My perspective is different now.", "REFLECTION_BANK"),
        word("realize", "깨닫다", "Over time, I started to realize new things.", "REFLECTION_BANK"),
        word("experience", "경험", "A personal experience changed my mind.", "REFLECTION_BANK"),
        word("value", "가치", "I value something different now.", "REFLECTION_BANK"),
        word("lesson", "교훈", "The lesson took time to understand.", "REFLECTION_BANK"),
        word("growth", "성장", "Growth often feels slow at first.", "REFLECTION_BANK"),
        word("mindset", "생각하는 방식", "My mindset became more flexible.", "REFLECTION_BANK"),
        word("awareness", "자각", "That experience brought more awareness.", "REFLECTION_BANK"),
        word("maturity", "성숙함", "Maturity changed how I look at it.", "REFLECTION_BANK"),
        word("rethink", "다시 생각하다", "I had to rethink my old view.", "REFLECTION_BANK"),
        word("habit", "습관", "A small habit changed the way I felt.", "REFLECTION_BANK"),
    ],
    "general": [
        word("meaningful", "의미 있는", "It still feels meaningful to me.", "GENERAL_BANK"),
        word("detail", "세부적인 부분", "One small detail makes it memorable.", "GENERAL_BANK"),
        word("atmosphere", "분위기", "The atmosphere is the first thing I notice.", "GENERAL_BANK"),
        word("familiar", "익숙한", "Its familiar feeling matters a lot to me.", "GENERAL_BANK"),
        word("practical", "실용적인", "It is practical in everyday life.", "GENERAL_BANK"),
        word("memorable", "기억에 남는", "It became memorable for a personal reason.", "GENERAL_BANK"),
        word("connection", "연결감", "It gives me a sense of connection.", "GENERAL_BANK"),
        word("useful", "유용한", "It is more useful than it looks.", "GENERAL_BANK"),
        word("ordinary", "평범한", "Something ordinary can still matter a lot.", "GENERAL_BANK"),
        word("unique", "특별한", "Its unique side is easy to remember.", "GENERAL_BANK"),
        word("comforting", "위로가 되는", "It feels comforting in a quiet way.", "GENERAL_BANK"),
        word("lasting", "오래 남는", "The feeling has stayed with me for a long time.", "GENERAL_BANK"),
    ],
}


CATEGORY_PHRASE_BANKS = {
    "routine": [
        phrase("first of all", "우선", "First of all, I put things back in place.", "ROUTINE_PHRASE"),
        phrase("after that", "그 다음에", "After that, I move on to the next task.", "ROUTINE_PHRASE"),
        phrase("as part of my routine", "내 루틴의 일부로", "I do it as part of my routine.", "ROUTINE_PHRASE"),
        phrase("what helps most is", "가장 도움이 되는 것은", "What helps most is the quiet start.", "ROUTINE_PHRASE"),
        phrase("by the time I finish", "다 끝낼 즈음에는", "By the time I finish, I feel calmer.", "ROUTINE_PHRASE"),
        phrase("the part I repeat most", "가장 자주 반복하는 부분", "The part I repeat most is the simplest step.", "ROUTINE_PHRASE"),
    ],
    "preference": [
        phrase("what I enjoy most", "내가 가장 즐기는 점", "What I enjoy most is the simple flavor.", "PREFERENCE_PHRASE"),
        phrase("one reason I keep choosing it", "계속 그것을 고르는 이유 하나는", "One reason I keep choosing it is comfort.", "PREFERENCE_PHRASE"),
        phrase("it feels right when", "그것이 잘 맞는 순간은", "It feels right when I need a short break.", "PREFERENCE_PHRASE"),
        phrase("I always come back to it", "나는 결국 다시 그것으로 돌아간다", "I always come back to it after trying other options.", "PREFERENCE_PHRASE"),
        phrase("the thing that stands out", "눈에 띄는 점", "The thing that stands out is the texture.", "PREFERENCE_PHRASE"),
        phrase("it suits my mood", "내 기분에 잘 맞는다", "It suits my mood on busy days.", "PREFERENCE_PHRASE"),
    ],
    "goal": [
        phrase("my first step", "첫 단계", "My first step will be making time for it.", "GOAL_PHRASE"),
        phrase("little by little", "조금씩", "I want to improve little by little.", "GOAL_PHRASE"),
        phrase("to stay consistent", "꾸준히 하기 위해", "To stay consistent, I need a simple plan.", "GOAL_PHRASE"),
        phrase("week by week", "한 주씩", "Week by week, I want to see real progress.", "GOAL_PHRASE"),
        phrase("make time for", "시간을 따로 내다", "I need to make time for it on purpose.", "GOAL_PHRASE"),
        phrase("keep track of", "기록하며 관리하다", "I will keep track of small changes.", "GOAL_PHRASE"),
    ],
    "problem": [
        phrase("when this happens", "이럴 때", "When this happens, I slow down first.", "PROBLEM_PHRASE"),
        phrase("deal with it", "그것을 처리하다", "I try to deal with it before it grows.", "PROBLEM_PHRASE"),
        phrase("step by step", "차근차근", "Step by step, it becomes easier to manage.", "PROBLEM_PHRASE"),
        phrase("what helps me most", "나에게 가장 도움이 되는 것", "What helps me most is breaking it down.", "PROBLEM_PHRASE"),
        phrase("make it manageable", "감당 가능한 크기로 만들다", "I try to make it manageable first.", "PROBLEM_PHRASE"),
        phrase("calm down first", "먼저 진정하다", "I need to calm down first.", "PROBLEM_PHRASE"),
    ],
    "balance": [
        phrase("on the one hand", "한편으로는", "On the one hand, it saves time.", "BALANCE_PHRASE"),
        phrase("on the other hand", "반면에", "On the other hand, it can cause new problems.", "BALANCE_PHRASE"),
        phrase("in some cases", "어떤 경우에는", "In some cases, the benefits are much clearer.", "BALANCE_PHRASE"),
        phrase("from another angle", "다른 각도에서 보면", "From another angle, the drawbacks matter more.", "BALANCE_PHRASE"),
        phrase("in the long run", "장기적으로 보면", "In the long run, balance matters most.", "BALANCE_PHRASE"),
        phrase("overall, I think", "전반적으로 나는", "Overall, I think the good side is slightly stronger.", "BALANCE_PHRASE"),
    ],
    "opinion": [
        phrase("in my view", "내 생각에는", "In my view, the role should be practical.", "OPINION_PHRASE"),
        phrase("for the community", "지역사회를 위해", "It should do more for the community.", "OPINION_PHRASE"),
        phrase("one important role", "중요한 역할 하나는", "One important role is creating access.", "OPINION_PHRASE"),
        phrase("this matters because", "이것이 중요한 이유는", "This matters because it affects daily life.", "OPINION_PHRASE"),
        phrase("in practice", "실제로는", "In practice, people need clear support.", "OPINION_PHRASE"),
        phrase("as a result", "그 결과", "As a result, trust can grow over time.", "OPINION_PHRASE"),
    ],
    "reflection": [
        phrase("I used to think", "예전에는 생각했다", "I used to think it was less important.", "REFLECTION_PHRASE"),
        phrase("now I see", "지금은 보인다", "Now I see the issue differently.", "REFLECTION_PHRASE"),
        phrase("over time", "시간이 지나면서", "Over time, my view became more balanced.", "REFLECTION_PHRASE"),
        phrase("because of that", "그 일 때문에", "Because of that, I changed my mind.", "REFLECTION_PHRASE"),
        phrase("looking back", "돌이켜보면", "Looking back, I was too narrow before.", "REFLECTION_PHRASE"),
        phrase("these days", "요즘은", "These days, I value it more.", "REFLECTION_PHRASE"),
    ],
    "general": [
        phrase("stands out to me", "내게 특히 눈에 띈다", "It still stands out to me now.", "GENERAL_PHRASE"),
        phrase("reminds me of", "무언가를 떠올리게 한다", "It reminds me of a specific season.", "GENERAL_PHRASE"),
        phrase("what I notice most", "내가 가장 먼저 느끼는 점", "What I notice most is the atmosphere.", "GENERAL_PHRASE"),
        phrase("because of that", "그 때문에", "Because of that, it became more meaningful.", "GENERAL_PHRASE"),
        phrase("one small detail", "작은 디테일 하나", "One small detail made me remember it.", "GENERAL_PHRASE"),
        phrase("the reason it matters", "그것이 중요한 이유", "The reason it matters is very personal.", "GENERAL_PHRASE"),
    ],
}


def rotate_pick(bank: list[dict[str, str]], count: int, offset: int) -> list[dict[str, str]]:
    return [bank[(offset + idx) % len(bank)] for idx in range(count)]


def topic_record(detail_name: str, detail_ko: str, prompt_en: str, prompt_ko: str) -> dict[str, str]:
    return {
        "detail_name": detail_name,
        "detail_ko": detail_ko,
        "prompt_en": prompt_en,
        "prompt_ko": prompt_ko,
    }


TOPIC_RECORDS = {
    "routine": [topic_record(*row) for row in ROUTINE_TOPICS],
    "preference": [topic_record(*row) for row in PREFERENCE_TOPICS],
    "goal": [topic_record(*row) for row in GOAL_TOPICS],
    "problem": [topic_record(*row) for row in PROBLEM_TOPICS],
    "balance": [topic_record(*row) for row in BALANCE_TOPICS],
    "opinion": [topic_record(*row) for row in OPINION_TOPICS],
    "reflection": [topic_record(*row) for row in REFLECTION_TOPICS],
    "general": [topic_record(*row) for row in GENERAL_TOPICS],
}


def is_plural_subject(subject: str) -> bool:
    subject_l = subject.lower().strip()
    singular_overrides = (
        "customer service",
        "shopping",
        "hot-desking",
        "public transportation",
        "financial education",
        "local volunteering",
    )
    if any(subject_l.endswith(token) for token in singular_overrides):
        return False
    return subject_l.endswith("s") and not subject_l.endswith("ss")


def front_context(context: str) -> str:
    normalized = context.strip()
    replacements = {
        "after coming back from a shopping trip": "after a shopping trip",
        "after finishing household chores": "after finishing your household chores",
    }
    normalized = replacements.get(normalized.lower(), normalized)
    return normalized[:1].upper() + normalized[1:]


GENERAL_SUBJECT_OVERRIDES = {
    "small shop you like": "a small shop you like",
    "website you find useful": "a website you find useful",
    "family tradition you value": "a family tradition you value",
    "place where you like to walk": "a place where you like to walk",
    "household item you use often": "a household item you use often",
}


def routine_question(topic_row: dict[str, str], template_index: int) -> tuple[str, str]:
    context_en = topic_row["prompt_en"]
    context_ko = topic_row["prompt_ko"]
    templates = [
        (
            f"What do you usually do {context_en}, and which part of that routine helps you the most?",
            f"{context_ko} 보통 무엇을 하고, 그 루틴에서 가장 도움이 되는 부분이 무엇인지 설명해 주세요.",
        ),
        (
            f"What do you usually do {context_en}, and why does that routine work well for you?",
            f"{context_ko} 보통 어떻게 보내는지, 그리고 그 루틴이 왜 잘 맞는지 설명해 주세요.",
        ),
        (
            f"{front_context(context_en)}, what do you usually do, and why?",
            f"{context_ko} 보통 무엇을 하는지, 그리고 왜 그렇게 하는지 말해 주세요.",
        ),
    ]
    return templates[template_index % len(templates)]


def preference_question(topic_row: dict[str, str], template_index: int) -> tuple[str, str]:
    subject_en = topic_row["prompt_en"]
    subject_ko = topic_row["prompt_ko"]
    templates = [
        (
            f"What is your favorite {subject_en}, and why do you like it?",
            f"{subject_ko} 중에서 가장 좋아하는 것을 소개하고, 왜 즐기는지 설명해 주세요.",
        ),
        (
            f"Tell me about your favorite {subject_en} and explain why you like it so much.",
            f"가장 좋아하는 {subject_ko}에 대해 말하고, 계속 그것을 고르는 이유를 설명해 주세요.",
        ),
        (
            f"Describe your favorite {subject_en} and explain what you like most about it.",
            f"가장 좋아하는 {subject_ko}을 설명하고, 그중 무엇을 가장 좋아하는지 말해 주세요.",
        ),
    ]
    return templates[template_index % len(templates)]


def goal_question(topic_row: dict[str, str], template_index: int) -> tuple[str, str]:
    focus_en = topic_row["prompt_en"]
    focus_ko = topic_row["prompt_ko"]
    templates = [
        (
            f"What is one goal you have for {focus_en} this year, and how will you work toward it?",
            f"올해 {focus_ko}와 관련해 이루고 싶은 목표 한 가지와, 그것을 위해 어떻게 노력할지 설명해 주세요.",
        ),
        (
            f"Describe one plan you have for {focus_en} this year and explain how you will stay consistent.",
            f"올해 {focus_ko}와 관련해 세운 계획 한 가지와, 어떻게 꾸준히 이어 갈지 설명해 주세요.",
        ),
        (
            f"What do you want to improve about {focus_en} this year, and what steps will you take?",
            f"올해 {focus_ko}와 관련해 무엇을 더 잘하고 싶은지, 그리고 어떤 단계를 밟을지 말해 주세요.",
        ),
    ]
    return templates[template_index % len(templates)]


def problem_question(topic_row: dict[str, str], template_index: int) -> tuple[str, str]:
    challenge_en = topic_row["prompt_en"]
    challenge_ko = topic_row["prompt_ko"]
    templates = [
        (
            f"What is one challenge you often face when {challenge_en}, and how do you handle it?",
            f"{challenge_ko} 때문에 어려움을 느낄 때가 있다면, 보통 어떻게 해결하는지 설명해 주세요.",
        ),
        (
            f"Describe a problem you sometimes have when {challenge_en} and explain what you do about it.",
            f"{challenge_ko} 때문에 생기는 문제 한 가지를 설명하고, 어떻게 대처하는지 말해 주세요.",
        ),
        (
            f"When it is hard to {challenge_en}, what do you usually do to deal with it?",
            f"{challenge_ko}이(가) 특히 어렵게 느껴질 때, 보통 어떻게 관리하는지 설명해 주세요.",
        ),
    ]
    return templates[template_index % len(templates)]


def balance_question(topic_row: dict[str, str], template_index: int) -> tuple[str, str]:
    subject_en = topic_row["prompt_en"]
    subject_ko = topic_row["prompt_ko"]
    be_verb = "are" if is_plural_subject(subject_en) else "is"
    templates = [
        (
            f"What are the benefits and drawbacks of {subject_en}, and what is your view?",
            f"{subject_ko}의 장점과 단점을 말하고, 당신의 생각을 설명해 주세요.",
        ),
        (
            f"Do you think {subject_en} {be_verb} more helpful or harmful overall? Explain both sides and give your opinion.",
            f"{subject_ko}이(가) 대체로 도움이 된다고 생각하는지, 아니면 해가 된다고 생각하는지 양쪽 입장을 함께 설명해 주세요.",
        ),
        (
            f"What do you see as the strengths and weaknesses of {subject_en}, and which side seems stronger to you?",
            f"{subject_ko}의 강점과 약점을 어떻게 보는지, 그리고 어느 쪽이 더 크다고 느끼는지 말해 주세요.",
        ),
    ]
    return templates[template_index % len(templates)]


def opinion_question(topic_row: dict[str, str], template_index: int) -> tuple[str, str]:
    subject_en = topic_row["prompt_en"]
    subject_ko = topic_row["prompt_ko"]
    templates = [
        (
            f"What role should {subject_en} play in modern society?",
            f"현대 사회에서 {subject_ko}에 기대하는 역할은 무엇인지 말해 주세요.",
        ),
        (
            f"What role should {subject_en} play in the community today?",
            f"오늘날 지역사회에서 {subject_ko}이(가) 가져야 할 책임은 무엇이라고 생각하는지 설명해 주세요.",
        ),
        (
            f"In your opinion, how should {subject_en} serve people in modern society?",
            f"현대 사회에서 {subject_ko}이(가) 사람들을 위해 어떤 일을 해야 한다고 생각하는지 말해 주세요.",
        ),
    ]
    return templates[template_index % len(templates)]


def reflection_question(topic_row: dict[str, str], template_index: int) -> tuple[str, str]:
    subject_en = topic_row["prompt_en"]
    subject_ko = topic_row["prompt_ko"]
    templates = [
        (
            f"How has your view of {subject_en} changed over time, and why?",
            f"{subject_ko}에 대한 생각이 시간이 지나며 어떻게 바뀌었는지, 그리고 그 이유를 설명해 주세요.",
        ),
        (
            f"How has your understanding of {subject_en} changed as you have grown, and what influenced that change?",
            f"살아오면서 {subject_ko}에 대한 이해가 어떻게 달라졌는지, 그리고 무엇이 그 변화를 만들었는지 말해 주세요.",
        ),
        (
            f"Tell me how your opinion of {subject_en} has changed over time and explain why.",
            f"{subject_ko}에 대한 생각이 예전과 어떻게 달라졌는지, 그리고 왜 바뀌었는지 이야기해 주세요.",
        ),
    ]
    return templates[template_index % len(templates)]


def general_question(topic_row: dict[str, str], template_index: int) -> tuple[str, str]:
    subject_en = GENERAL_SUBJECT_OVERRIDES.get(topic_row["prompt_en"], topic_row["prompt_en"])
    subject_ko = topic_row["prompt_ko"]
    templates = [
        (
            f"Describe {subject_en} and explain why it matters to you.",
            f"{subject_ko}에 대해 설명하고, 왜 당신에게 의미 있는지 말해 주세요.",
        ),
        (
            f"Tell me about {subject_en} and explain why it is important to you.",
            f"{subject_ko}에 대해 말하고, 왜 의미 있게 느껴지는지 설명해 주세요.",
        ),
        (
            f"Describe {subject_en} and explain why it stands out to you.",
            f"당신에게 특히 기억에 남는 {subject_ko}을 설명하고, 왜 또렷이 기억하는지 말해 주세요.",
        ),
    ]
    return templates[template_index % len(templates)]


def starter_item(category_key: str, topic_row: dict[str, str]) -> dict[str, str]:
    if category_key == "routine":
        return frame(
            f"{topic_row['prompt_en'].capitalize()}, I usually ...",
            f"{topic_row['prompt_ko']}에는 보통 ...",
            "먼저 언제의 루틴인지 말하고, 바로 이어서 하는 일을 붙여 보세요.",
            f"{topic_row['prompt_en'].capitalize()}, I usually put my things away and make a short plan.",
            "STARTER_ROUTINE",
        )
    if category_key == "preference":
        return frame(
            f"My favorite {topic_row['prompt_en']} is ... because ...",
            f"제가 가장 좋아하는 {topic_row['prompt_ko']}은 ...이고, 이유는 ...",
            "가장 좋아하는 대상과 이유를 한 문장으로 먼저 꺼내 보세요.",
            f"My favorite {topic_row['prompt_en']} is a light one because it feels comfortable.",
            "STARTER_PREFERENCE",
        )
    if category_key == "goal":
        return frame(
            f"One goal I have for {topic_row['prompt_en']} this year is ...",
            f"올해 {topic_row['prompt_ko']}와 관련해 이루고 싶은 목표 한 가지는 ...",
            "목표를 먼저 분명하게 말한 뒤, 실행 계획을 이어 보세요.",
            f"One goal I have for {topic_row['prompt_en']} this year is building a more stable routine.",
            "STARTER_GOAL",
        )
    if category_key == "problem":
        return frame(
            f"One challenge I have with {topic_row['prompt_en']} is ...",
            f"{topic_row['prompt_ko']} 때문에 겪는 어려움 한 가지는 ...",
            "문제를 먼저 짚고, 다음 문장에서 대처 방법을 붙이면 자연스럽습니다.",
            f"One challenge I have with {topic_row['prompt_en']} is keeping my attention where I want it.",
            "STARTER_PROBLEM",
        )
    if category_key == "balance":
        return frame(
            f"I think {topic_row['prompt_en']} have both strengths and weaknesses.",
            f"{topic_row['prompt_ko']}에는 장점과 단점이 모두 있다고 생각해요.",
            "찬반형 질문은 양쪽 관점을 먼저 열어 두면 답이 안정적입니다.",
            f"I think {topic_row['prompt_en']} have both clear advantages and real limits.",
            "STARTER_BALANCE",
        )
    if category_key == "opinion":
        return frame(
            f"In my view, {topic_row['prompt_en']} should ...",
            f"제 생각에는 {topic_row['prompt_ko']}이(가) ... 해야 해요.",
            "먼저 입장을 밝히고, 뒤에서 이유나 예시를 붙여 보세요.",
            f"In my view, {topic_row['prompt_en']} should support people in practical ways.",
            "STARTER_OPINION",
        )
    if category_key == "reflection":
        return frame(
            f"I used to think differently about {topic_row['prompt_en']}, but now ...",
            f"예전에는 {topic_row['prompt_ko']}에 대해 다르게 생각했지만, 지금은 ...",
            "과거 생각과 지금 생각을 대비하면 답이 훨씬 선명해집니다.",
            f"I used to think differently about {topic_row['prompt_en']}, but now I see it more calmly.",
            "STARTER_REFLECTION",
        )
    return frame(
        f"One thing that stands out to me is {topic_row['prompt_en']} because ...",
        f"제게 특히 떠오르는 것은 {topic_row['prompt_ko']}인데, 이유는 ...",
        "대상을 먼저 소개하고, 왜 기억에 남는지 바로 이어 보세요.",
        f"One thing that stands out to me is {topic_row['prompt_en']} because it feels familiar and personal.",
        "STARTER_GENERAL",
    )


def extra_items(category_key: str) -> list[dict[str, str]]:
    if category_key == "routine":
        return [
            frame("First, I ...", "먼저 저는 ...", "순서를 잡아 줄 때 좋아요.", "First, I put away what I used.", "ROUTINE_EXTRA"),
            frame("After that, I ...", "그 다음에는 ...", "루틴의 두 번째 단계를 덧붙일 때 좋아요.", "After that, I slow down and check what comes next.", "ROUTINE_EXTRA"),
            frame("The part that helps me most is ...", "가장 도움이 되는 부분은 ...", "루틴의 핵심 효과를 말할 때 좋아요.", "The part that helps me most is the quiet start.", "ROUTINE_EXTRA"),
            frame("This routine works for me because ...", "이 루틴이 잘 맞는 이유는 ...", "루틴의 이유를 붙여 보세요.", "This routine works for me because it makes the rest of my day easier.", "ROUTINE_EXTRA"),
        ]
    if category_key == "preference":
        return [
            frame("What I like most about it is ...", "그것에서 제가 가장 좋아하는 점은 ...", "구체적인 매력을 한 가지 집어 말해 보세요.", "What I like most about it is the calm feeling it gives me.", "PREFERENCE_EXTRA"),
            frame("I usually choose it when ...", "저는 보통 ...할 때 그것을 고릅니다.", "어떤 상황에서 고르는지 덧붙이면 자연스럽습니다.", "I usually choose it when I want something simple and familiar.", "PREFERENCE_EXTRA"),
            frame("One reason I keep choosing it is ...", "계속 그것을 고르는 이유 하나는 ...", "이유를 짧게 이어 붙이기 좋습니다.", "One reason I keep choosing it is that it matches my mood.", "PREFERENCE_EXTRA"),
            frame("It feels ... to me because ...", "제게 그것은 ...하게 느껴져요, 왜냐하면 ...", "감정과 이유를 같이 넣어 보세요.", "It feels comforting to me because it never feels too much.", "PREFERENCE_EXTRA"),
        ]
    if category_key == "goal":
        return [
            frame("My first step will be ...", "첫 단계는 ...일 거예요.", "실행 계획의 시작을 말할 때 좋아요.", "My first step will be making a small weekly plan.", "GOAL_EXTRA"),
            frame("To stay consistent, I will ...", "꾸준히 하기 위해 저는 ...할 거예요.", "지속 전략을 붙이면 답이 탄탄해집니다.", "To stay consistent, I will keep the task small.", "GOAL_EXTRA"),
            frame("I want this to become part of my routine.", "이것을 제 루틴의 일부로 만들고 싶어요.", "목표의 방향을 자연스럽게 강조할 수 있어요.", "I want this to become part of my routine.", "GOAL_EXTRA"),
            frame("This matters to me because ...", "이게 저에게 중요한 이유는 ...", "개인적인 이유를 꼭 붙여 보세요.", "This matters to me because I feel better when I keep my promises to myself.", "GOAL_EXTRA"),
        ]
    if category_key == "problem":
        return [
            frame("When this happens, I first ...", "이럴 때 저는 먼저 ...", "첫 대응을 말하면 답이 구체적이 됩니다.", "When this happens, I first slow down and look at the next small step.", "PROBLEM_EXTRA"),
            frame("A strategy that helps me is ...", "도움이 되는 방법 하나는 ...", "반복해서 쓰는 대처법을 말할 때 좋아요.", "A strategy that helps me is breaking the problem into smaller parts.", "PROBLEM_EXTRA"),
            frame("It becomes easier when I ...", "저는 ...하면 조금 더 쉬워져요.", "개선 조건을 말해 보세요.", "It becomes easier when I give myself a clear starting point.", "PROBLEM_EXTRA"),
            frame("I am still learning to ...", "저는 아직 ...하는 법을 배우는 중이에요.", "완벽하지 않아도 성찰을 보여 줄 수 있어요.", "I am still learning to react less quickly.", "PROBLEM_EXTRA"),
        ]
    if category_key == "balance":
        return [
            frame("One advantage is ...", "장점 하나는 ...", "좋은 점을 먼저 분명히 말해 보세요.", "One advantage is that it can save time.", "BALANCE_EXTRA"),
            frame("A possible drawback is ...", "가능한 단점 하나는 ...", "반대쪽 포인트도 함께 넣어 보세요.", "A possible drawback is that it can make people too dependent.", "BALANCE_EXTRA"),
            frame("In real life, this can help because ...", "실제로는 ... 때문에 도움이 될 수 있어요.", "현실적인 효과를 붙이면 설득력이 올라갑니다.", "In real life, this can help because people often want a faster option.", "BALANCE_EXTRA"),
            frame("Overall, I think ...", "전체적으로 보면 저는 ...라고 생각해요.", "마지막 입장을 정리할 때 좋아요.", "Overall, I think the good side is a little stronger.", "BALANCE_EXTRA"),
        ]
    if category_key == "opinion":
        return [
            frame("In my view, they should ...", "제 생각에는 그들이 ...해야 해요.", "입장을 또렷하게 정리할 때 좋아요.", "In my view, they should focus on practical support.", "OPINION_EXTRA"),
            frame("This matters because ...", "이것이 중요한 이유는 ...", "이유를 한 문장으로 붙여 보세요.", "This matters because daily life becomes easier when support is clear.", "OPINION_EXTRA"),
            frame("A good example would be ...", "좋은 예로는 ...가 있어요.", "추상적인 주장에 예시를 붙여 보세요.", "A good example would be a program that reaches people who are often left out.", "OPINION_EXTRA"),
            frame("That is why I believe ...", "그래서 저는 ...라고 생각해요.", "결론 문장을 만들 때 좋아요.", "That is why I believe the role should be more active and visible.", "OPINION_EXTRA"),
        ]
    if category_key == "reflection":
        return [
            frame("I used to think ..., but now ...", "예전에는 ...라고 생각했지만 지금은 ...", "과거와 현재를 바로 대비할 수 있어요.", "I used to think speed mattered most, but now I care more about balance.", "REFLECTION_EXTRA"),
            frame("What changed my mind was ...", "제 생각을 바꾼 것은 ...", "변화의 계기를 직접 말해 보세요.", "What changed my mind was a small but clear experience.", "REFLECTION_EXTRA"),
            frame("Over time, I realized ...", "시간이 지나며 저는 ...를 깨달았어요.", "차분한 성찰 문장으로 좋습니다.", "Over time, I realized that I had been too narrow before.", "REFLECTION_EXTRA"),
            frame("Now I value ... more.", "이제는 ...을 더 중요하게 여겨요.", "지금의 관점을 짧게 정리해 보세요.", "Now I value steadiness more.", "REFLECTION_EXTRA"),
        ]
    return [
        frame("What stands out most is ...", "가장 눈에 띄는 점은 ...", "대상의 특징을 먼저 말할 때 좋아요.", "What stands out most is its calm atmosphere.", "GENERAL_EXTRA"),
        frame("I remember it because ...", "그것이 기억에 남는 이유는 ...", "기억의 이유를 붙여 보세요.", "I remember it because it appeared at the right moment in my life.", "GENERAL_EXTRA"),
        frame("A small detail I notice is ...", "제가 눈여겨보는 작은 디테일은 ...", "구체적인 디테일을 더해 보세요.", "A small detail I notice is the way it changes with time.", "GENERAL_EXTRA"),
        frame("It feels meaningful to me because ...", "그것이 제게 의미 있는 이유는 ...", "개인적인 이유를 마무리로 넣어 보세요.", "It feels meaningful to me because it connects everyday life and memory.", "GENERAL_EXTRA"),
    ]


def slot_config(category_key: str, topic_index: int) -> tuple[list[str], list[str]]:
    if category_key == "routine":
        return ["MAIN_ANSWER", "ACTIVITY"], ["TIME_OR_PLACE", "FEELING"]
    if category_key == "preference":
        return ["MAIN_ANSWER", "REASON"], ["FEELING", "EXAMPLE"]
    if category_key == "goal":
        if topic_index % 2 == 0:
            return ["MAIN_ANSWER", "ACTIVITY"], ["REASON", "TIME_OR_PLACE"]
        return ["MAIN_ANSWER", "REASON"], ["ACTIVITY", "TIME_OR_PLACE"]
    if category_key == "problem":
        return ["MAIN_ANSWER", "ACTIVITY"], ["REASON", "EXAMPLE"]
    if category_key == "balance":
        return ["MAIN_ANSWER", "REASON"], ["EXAMPLE", "FEELING"]
    if category_key == "opinion":
        return ["MAIN_ANSWER", "REASON"], ["EXAMPLE"]
    if category_key == "reflection":
        return ["MAIN_ANSWER", "REASON"], ["TIME_OR_PLACE", "FEELING"]
    return ["MAIN_ANSWER", "REASON"], ["EXAMPLE", "FEELING"]


CATEGORY_SPECS = {
    "routine": {
        "category_name": "Routine",
        "prompt_prefix": "prompt-routine-1",
        "hint_prefix": "hint-routine-1",
        "difficulty": "A",
        "answer_mode": "ROUTINE",
        "expected_tense": "PRESENT_SIMPLE",
        "expected_pov": "FIRST_PERSON",
        "tip": "순서와 자주 하는 행동을 함께 넣으면 루틴 답변이 더 자연스러워집니다.",
        "question_factory": routine_question,
        "hint4_type": "STRUCTURE",
        "hint4_title": "문장 흐름",
    },
    "preference": {
        "category_name": "Preference",
        "prompt_prefix": "prompt-preference-1",
        "hint_prefix": "hint-preference-1",
        "difficulty": "A",
        "answer_mode": "PREFERENCE",
        "expected_tense": "PRESENT_SIMPLE",
        "expected_pov": "FIRST_PERSON",
        "tip": "좋아하는 이유와 느낌을 함께 넣으면 답변이 더 또렷해집니다.",
        "question_factory": preference_question,
        "hint4_type": "DETAIL",
        "hint4_title": "이유 확장",
    },
    "goal": {
        "category_name": "Goal Plan",
        "prompt_prefix": "prompt-goal-1",
        "hint_prefix": "hint-goal-1",
        "difficulty": "B",
        "answer_mode": "GOAL_PLAN",
        "expected_tense": "FUTURE_PLAN",
        "expected_pov": "FIRST_PERSON",
        "tip": "목표와 실행 계획을 분리해서 말하면 B 난이도 답변이 더 안정적입니다.",
        "question_factory": goal_question,
        "hint4_type": "STRUCTURE",
        "hint4_title": "계획 연결",
    },
    "problem": {
        "category_name": "Problem Solving",
        "prompt_prefix": "prompt-problem-1",
        "hint_prefix": "hint-problem-1",
        "difficulty": "B",
        "answer_mode": "PROBLEM_SOLUTION",
        "expected_tense": "PRESENT_SIMPLE",
        "expected_pov": "FIRST_PERSON",
        "tip": "문제, 대응, 배운 점 순서로 말하면 답변이 훨씬 단단해집니다.",
        "question_factory": problem_question,
        "hint4_type": "STRUCTURE",
        "hint4_title": "대처 흐름",
    },
    "balance": {
        "category_name": "Balanced Opinion",
        "prompt_prefix": "prompt-balance-1",
        "hint_prefix": "hint-balance-1",
        "difficulty": "C",
        "answer_mode": "BALANCED_OPINION",
        "expected_tense": "PRESENT_SIMPLE",
        "expected_pov": "GENERAL_OR_FIRST_PERSON",
        "tip": "찬반형 질문은 장점과 단점을 모두 짚고 마지막에 입장을 정리하는 것이 좋습니다.",
        "question_factory": balance_question,
        "hint4_type": "STRUCTURE",
        "hint4_title": "찬반 정리",
    },
    "opinion": {
        "category_name": "Opinion Reason",
        "prompt_prefix": "prompt-opinion-1",
        "hint_prefix": "hint-opinion-1",
        "difficulty": "C",
        "answer_mode": "OPINION_REASON",
        "expected_tense": "PRESENT_SIMPLE",
        "expected_pov": "GENERAL_OR_FIRST_PERSON",
        "tip": "입장을 먼저 밝히고 이유와 예시를 하나씩 붙이면 의견형 답변이 더 설득력 있어집니다.",
        "question_factory": opinion_question,
        "hint4_type": "DETAIL",
        "hint4_title": "입장 강화",
    },
    "reflection": {
        "category_name": "Change Reflection",
        "prompt_prefix": "prompt-reflection-1",
        "hint_prefix": "hint-reflection-1",
        "difficulty": "C",
        "answer_mode": "CHANGE_REFLECTION",
        "expected_tense": "MIXED_PAST_PRESENT",
        "expected_pov": "FIRST_PERSON",
        "tip": "과거 생각과 현재 생각, 변화를 만든 계기를 함께 말하면 깊이가 살아납니다.",
        "question_factory": reflection_question,
        "hint4_type": "STRUCTURE",
        "hint4_title": "변화 서술",
    },
    "general": {
        "category_name": "General",
        "prompt_prefix": "prompt-general-1",
        "hint_prefix": "hint-general-1",
        "difficulty": "C",
        "answer_mode": "GENERAL_DESCRIPTION",
        "expected_tense": "PRESENT_SIMPLE",
        "expected_pov": "FIRST_PERSON",
        "tip": "대상 설명과 개인적 의미를 함께 말하면 일반 서술형 답변이 더 풍부해집니다.",
        "question_factory": general_question,
        "hint4_type": "DETAIL",
        "hint4_title": "기억 포인트",
    },
}


def sql_string(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("\\", "\\\\").replace("'", "''") + "'"


def normalize_question(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def parse_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def load_db_config(env_path: Path) -> dict[str, Any]:
    env = parse_env_file(env_path)
    match = re.match(
        r"jdbc:mysql://(?P<host>[^:/?#]+)(?::(?P<port>\d+))?/(?P<database>[^?]+)",
        env["SPRING_DATASOURCE_URL"],
    )
    if not match:
        raise RuntimeError(f"Could not parse datasource url from {env_path}")
    host = match.group("host")
    if host == "host.docker.internal":
        host = "127.0.0.1"
    return {
        "host": host,
        "port": int(match.group("port") or "3306"),
        "user": env["SPRING_DATASOURCE_USERNAME"],
        "password": env["SPRING_DATASOURCE_PASSWORD"],
        "database": match.group("database"),
        "charset": "utf8mb4",
        "autocommit": False,
        "cursorclass": pymysql.cursors.DictCursor,
    }


def fetch_existing_state(connection: Any) -> dict[str, Any]:
    state: dict[str, Any] = {
        "max_prompt_display_order": 0,
        "max_detail_order_by_category": {},
        "question_to_ids": defaultdict(set),
        "detail_names_by_category": defaultdict(set),
        "active_prompt_count": 0,
    }
    with connection.cursor() as cursor:
        cursor.execute("SELECT COALESCE(MAX(display_order), 0) AS max_order FROM prompts")
        state["max_prompt_display_order"] = int(cursor.fetchone()["max_order"] or 0)
        cursor.execute(
            """
            SELECT c.name AS category_name, COALESCE(MAX(d.display_order), 0) AS max_order
            FROM prompt_topic_categories c
            LEFT JOIN prompt_topic_details d ON d.category_id = c.id
            GROUP BY c.id, c.name
            """
        )
        for row in cursor.fetchall():
            state["max_detail_order_by_category"][row["category_name"]] = int(row["max_order"] or 0)
        cursor.execute("SELECT id, question_en FROM prompts")
        for row in cursor.fetchall():
            normalized = normalize_question(row["question_en"])
            if normalized:
                state["question_to_ids"][normalized].add(row["id"])
        cursor.execute(
            """
            SELECT c.name AS category_name, d.name AS detail_name
            FROM prompt_topic_details d
            JOIN prompt_topic_categories c ON c.id = d.category_id
            """
        )
        for row in cursor.fetchall():
            state["detail_names_by_category"][row["category_name"]].add(row["detail_name"])
        cursor.execute("SELECT COUNT(*) AS count FROM prompts WHERE is_active = 1")
        state["active_prompt_count"] = int(cursor.fetchone()["count"])
    return state


def build_item(item: dict[str, str], category_name: str, detail_name: str) -> dict[str, str]:
    usage_tip = item.get("usage_tip_ko") or f"{category_name} 카테고리의 {detail_name} 질문에서 자연스럽게 써 보세요."
    return {
        "item_type": item["item_type"],
        "content": item["content"],
        "meaning_ko": item["meaning_ko"],
        "usage_tip_ko": usage_tip,
        "example_en": item["example_en"],
        "expression_family": item["expression_family"],
    }


def build_records(existing_state: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    records = {
        "topics": [],
        "prompts": [],
        "task_profiles": [],
        "task_slots": [],
        "hints": [],
        "hint_items": [],
    }
    next_prompt_order = int(existing_state["max_prompt_display_order"]) + 1
    detail_orders = defaultdict(int, existing_state["max_detail_order_by_category"])

    for category_key in CATEGORY_ORDER:
        spec = CATEGORY_SPECS[category_key]
        topics = TOPIC_RECORDS[category_key]
        next_detail_order = detail_orders[spec["category_name"]] + 1
        for topic_index, topic_row in enumerate(topics):
            detail_order = next_detail_order + topic_index
            serial = 101 + topic_index
            serial_token = f"{serial:03d}"
            prompt_id = f"{spec['prompt_prefix']}{serial_token}"
            hint_prefix = f"{spec['hint_prefix']}{serial_token}"
            question_en, question_ko = spec["question_factory"](topic_row, topic_index)

            records["topics"].append(
                {
                    "category_name": spec["category_name"],
                    "detail_name": topic_row["detail_name"],
                    "display_order": detail_order,
                }
            )
            records["prompts"].append(
                {
                    "id": prompt_id,
                    "category_name": spec["category_name"],
                    "detail_name": topic_row["detail_name"],
                    "question_en": question_en,
                    "question_ko": question_ko,
                    "difficulty": spec["difficulty"],
                    "tip": spec["tip"],
                    "display_order": next_prompt_order,
                    "is_active": 1,
                }
            )
            next_prompt_order += 1

            required_slots, optional_slots = slot_config(category_key, topic_index)
            records["task_profiles"].append(
                {
                    "prompt_id": prompt_id,
                    "answer_mode_id": ANSWER_MODE_IDS[spec["answer_mode"]],
                    "expected_tense": spec["expected_tense"],
                    "expected_pov": spec["expected_pov"],
                    "is_active": 1,
                }
            )
            display_order = 1
            for slot_code in required_slots:
                records["task_slots"].append(
                    {
                        "prompt_id": prompt_id,
                        "slot_id": SLOT_IDS[slot_code],
                        "slot_role": "REQUIRED",
                        "display_order": display_order,
                        "is_active": 1,
                    }
                )
                display_order += 1
            for slot_code in optional_slots:
                records["task_slots"].append(
                    {
                        "prompt_id": prompt_id,
                        "slot_id": SLOT_IDS[slot_code],
                        "slot_role": "OPTIONAL",
                        "display_order": display_order,
                        "is_active": 1,
                    }
                )
                display_order += 1

            word_items = [
                build_item(item, spec["category_name"], topic_row["detail_name"])
                for item in rotate_pick(CATEGORY_WORD_BANKS[category_key], 8, topic_index % len(CATEGORY_WORD_BANKS[category_key]))
            ]
            phrase_items = [
                build_item(item, spec["category_name"], topic_row["detail_name"])
                for item in rotate_pick(CATEGORY_PHRASE_BANKS[category_key], 4, topic_index % len(CATEGORY_PHRASE_BANKS[category_key]))
            ]
            extra_hint_items = [
                build_item(item, spec["category_name"], topic_row["detail_name"])
                for item in extra_items(category_key)
            ]

            hint_rows = [
                {
                    "id": f"{hint_prefix}-1",
                    "prompt_id": prompt_id,
                    "hint_type": "STARTER",
                    "title": "시작 문장",
                    "display_order": 1,
                    "items": [build_item(starter_item(category_key, topic_row), spec["category_name"], topic_row["detail_name"])],
                },
                {
                    "id": f"{hint_prefix}-2",
                    "prompt_id": prompt_id,
                    "hint_type": "VOCAB_WORD",
                    "title": "단어 힌트",
                    "display_order": 2,
                    "items": word_items,
                },
                {
                    "id": f"{hint_prefix}-3",
                    "prompt_id": prompt_id,
                    "hint_type": "VOCAB_PHRASE",
                    "title": "표현 힌트",
                    "display_order": 3,
                    "items": phrase_items,
                },
                {
                    "id": f"{hint_prefix}-4",
                    "prompt_id": prompt_id,
                    "hint_type": spec["hint4_type"],
                    "title": spec["hint4_title"],
                    "display_order": 4,
                    "items": extra_hint_items,
                },
            ]

            for hint_row in hint_rows:
                records["hints"].append(
                    {
                        "id": hint_row["id"],
                        "prompt_id": hint_row["prompt_id"],
                        "hint_type": hint_row["hint_type"],
                        "title": hint_row["title"],
                        "display_order": hint_row["display_order"],
                        "is_active": 1,
                    }
                )
                for item_index, item in enumerate(hint_row["items"], start=1):
                    records["hint_items"].append(
                        {
                            "id": f"{hint_row['id']}-item-{item_index}",
                            "hint_id": hint_row["id"],
                            "display_order": item_index,
                            "is_active": 1,
                            **item,
                        }
                    )

    return records


def validate_records(records: dict[str, list[dict[str, Any]]], existing_state: dict[str, Any]) -> None:
    if len(records["topics"]) != 214:
        raise ValueError("Expected 214 topic details.")
    if len(records["prompts"]) != 214:
        raise ValueError("Expected 214 prompts.")
    if len(records["task_profiles"]) != 214:
        raise ValueError("Expected 214 task profiles.")
    if len(records["hints"]) != 856:
        raise ValueError("Expected 856 prompt hints.")
    if len(records["hint_items"]) != 3638:
        raise ValueError("Expected 3638 hint items.")
    if len(records["task_slots"]) != 829:
        raise ValueError("Expected 829 task slot rows.")

    seen_detail_names: dict[str, set[str]] = defaultdict(set)
    seen_questions: dict[str, str] = {}

    for topic_row in records["topics"]:
        category_name = topic_row["category_name"]
        detail_name = topic_row["detail_name"]
        if detail_name in existing_state["detail_names_by_category"][category_name]:
            raise ValueError(f"Detail name already exists: {category_name} / {detail_name}")
        if detail_name in seen_detail_names[category_name]:
            raise ValueError(f"Duplicate generated detail name: {category_name} / {detail_name}")
        seen_detail_names[category_name].add(detail_name)

    for prompt_row in records["prompts"]:
        normalized = normalize_question(prompt_row["question_en"])
        if normalized in seen_questions and seen_questions[normalized] != prompt_row["id"]:
            raise ValueError(f"Duplicate generated question: {prompt_row['question_en']}")
        existing_ids = existing_state["question_to_ids"].get(normalized, set())
        if existing_ids and prompt_row["id"] not in existing_ids:
            raise ValueError(f"Question already exists under different prompt: {prompt_row['question_en']}")
        seen_questions[normalized] = prompt_row["id"]


def values_insert(table: str, columns: list[str], rows: list[tuple[Any, ...]], updates: list[str], chunk_size: int) -> list[str]:
    statements: list[str] = []
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start:start + chunk_size]
        values_sql = ",\n".join(
            "(" + ", ".join(sql_string(value) for value in row) + ")"
            for row in chunk
        )
        updates_sql = ", ".join(f"{column}=VALUES({column})" for column in updates)
        statements.append(
            f"INSERT INTO {table} ({', '.join(columns)})\nVALUES\n{values_sql}\nON DUPLICATE KEY UPDATE {updates_sql};"
        )
    return statements


def build_sql(records: dict[str, list[dict[str, Any]]]) -> tuple[str, list[str]]:
    statements: list[str] = []
    statements.extend(
        values_insert(
            "prompt_topic_categories",
            ["name", "display_order", "is_active"],
            [
                ("Routine", 1, 1),
                ("Preference", 2, 1),
                ("Goal Plan", 3, 1),
                ("Problem Solving", 4, 1),
                ("Balanced Opinion", 5, 1),
                ("Opinion Reason", 6, 1),
                ("Change Reflection", 7, 1),
                ("General", 8, 1),
            ],
            ["display_order", "is_active"],
            20,
        )
    )

    for topic_row in records["topics"]:
        statements.append(
            "\n".join(
                [
                    "INSERT INTO prompt_topic_details (category_id, name, display_order, is_active)",
                    f"SELECT c.id, {sql_string(topic_row['detail_name'])}, {topic_row['display_order']}, 1",
                    "FROM prompt_topic_categories c",
                    f"WHERE c.name = {sql_string(topic_row['category_name'])}",
                    "ON DUPLICATE KEY UPDATE",
                    "display_order = VALUES(display_order),",
                    "is_active = VALUES(is_active);",
                ]
            )
        )

    for prompt_row in records["prompts"]:
        statements.append(
            "\n".join(
                [
                    "INSERT INTO prompts (id, question_en, question_ko, difficulty, tip, display_order, is_active, topic_detail_id)",
                    "SELECT",
                    f"    {sql_string(prompt_row['id'])},",
                    f"    {sql_string(prompt_row['question_en'])},",
                    f"    {sql_string(prompt_row['question_ko'])},",
                    f"    {sql_string(prompt_row['difficulty'])},",
                    f"    {sql_string(prompt_row['tip'])},",
                    f"    {prompt_row['display_order']},",
                    "    1,",
                    "    d.id",
                    "FROM prompt_topic_details d",
                    "JOIN prompt_topic_categories c ON c.id = d.category_id",
                    f"WHERE c.name = {sql_string(prompt_row['category_name'])}",
                    f"  AND d.name = {sql_string(prompt_row['detail_name'])}",
                    "ON DUPLICATE KEY UPDATE",
                    "question_en = VALUES(question_en),",
                    "question_ko = VALUES(question_ko),",
                    "difficulty = VALUES(difficulty),",
                    "tip = VALUES(tip),",
                    "display_order = VALUES(display_order),",
                    "is_active = VALUES(is_active),",
                    "topic_detail_id = VALUES(topic_detail_id);",
                ]
            )
        )

    statements.extend(
        values_insert(
            "prompt_task_profiles",
            ["prompt_id", "answer_mode_id", "expected_tense", "expected_pov", "is_active"],
            [(row["prompt_id"], row["answer_mode_id"], row["expected_tense"], row["expected_pov"], row["is_active"]) for row in records["task_profiles"]],
            ["answer_mode_id", "expected_tense", "expected_pov", "is_active"],
            200,
        )
    )
    statements.extend(
        values_insert(
            "prompt_task_profile_slots",
            ["prompt_id", "slot_id", "slot_role", "display_order", "is_active"],
            [(row["prompt_id"], row["slot_id"], row["slot_role"], row["display_order"], row["is_active"]) for row in records["task_slots"]],
            ["display_order", "is_active"],
            250,
        )
    )
    statements.extend(
        values_insert(
            "prompt_hints",
            ["id", "prompt_id", "hint_type", "title", "display_order", "is_active"],
            [(row["id"], row["prompt_id"], row["hint_type"], row["title"], row["display_order"], row["is_active"]) for row in records["hints"]],
            ["hint_type", "title", "display_order", "is_active"],
            250,
        )
    )
    statements.extend(
        values_insert(
            "prompt_hint_items",
            ["id", "hint_id", "item_type", "content", "meaning_ko", "usage_tip_ko", "example_en", "expression_family", "display_order", "is_active"],
            [(row["id"], row["hint_id"], row["item_type"], row["content"], row["meaning_ko"], row["usage_tip_ko"], row["example_en"], row["expression_family"], row["display_order"], row["is_active"]) for row in records["hint_items"]],
            ["item_type", "content", "meaning_ko", "usage_tip_ko", "example_en", "expression_family", "display_order", "is_active"],
            250,
        )
    )
    sql_text = "\n\n".join(
        [
            "-- Seed 214 unique prompts so active prompts reach 300 without paraphrase duplicates.",
            "-- Generated by scripts/generate_unique_prompt_batch_037.py",
            "",
        ] + statements
    )
    return sql_text, statements


def validate_against_db(statements: list[str], records: dict[str, list[dict[str, Any]]], env_path: Path) -> None:
    connection = pymysql.connect(**load_db_config(env_path))
    prompt_ids = [row["id"] for row in records["prompts"]]
    hint_ids = [row["id"] for row in records["hints"]]
    try:
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM prompts WHERE id IN ({', '.join(['%s'] * len(prompt_ids))})",
                prompt_ids,
            )
            if int(cursor.fetchone()["count"]) != 214:
                raise ValueError("Prompt validation count mismatch.")
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM prompt_task_profiles WHERE prompt_id IN ({', '.join(['%s'] * len(prompt_ids))})",
                prompt_ids,
            )
            if int(cursor.fetchone()["count"]) != 214:
                raise ValueError("Task profile validation count mismatch.")
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM prompt_task_profile_slots WHERE prompt_id IN ({', '.join(['%s'] * len(prompt_ids))})",
                prompt_ids,
            )
            if int(cursor.fetchone()["count"]) != 829:
                raise ValueError("Task slot validation count mismatch.")
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM prompt_hints WHERE prompt_id IN ({', '.join(['%s'] * len(prompt_ids))})",
                prompt_ids,
            )
            if int(cursor.fetchone()["count"]) != 856:
                raise ValueError("Hint validation count mismatch.")
            cursor.execute(
                f"SELECT COUNT(*) AS count FROM prompt_hint_items WHERE hint_id IN ({', '.join(['%s'] * len(hint_ids))})",
                hint_ids,
            )
            if int(cursor.fetchone()["count"]) != 3638:
                raise ValueError("Hint item validation count mismatch.")
            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM (
                    SELECT topic_detail_id
                    FROM prompts
                    WHERE is_active = 1
                      AND id IN ({ids})
                    GROUP BY topic_detail_id
                    HAVING COUNT(*) > 1
                ) duplicate_groups
                """.format(ids=", ".join(["%s"] * len(prompt_ids))),
                prompt_ids,
            )
            if int(cursor.fetchone()["count"]) != 0:
                raise ValueError("Generated prompt set contains duplicate active prompts per topic detail.")
    finally:
        connection.rollback()
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-db-validation", action="store_true")
    args = parser.parse_args()

    connection = pymysql.connect(**load_db_config(ENV_PATH))
    try:
        existing_state = fetch_existing_state(connection)
    finally:
        connection.close()

    records = build_records(existing_state)
    validate_records(records, existing_state)
    sql_text, statements = build_sql(records)
    if not args.skip_db_validation:
        validate_against_db(statements, records, ENV_PATH)
    OUTPUT_PATH.write_text(sql_text, encoding="utf-8")
    print(
        f"Generated {len(records['prompts'])} prompts, "
        f"{len(records['topics'])} topics, "
        f"{len(records['task_slots'])} task slots, "
        f"{len(records['hints'])} hints, "
        f"{len(records['hint_items'])} hint items."
    )
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
