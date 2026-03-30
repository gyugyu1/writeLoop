param(
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Escape-Sql {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    return $Value.Replace("'", "''")
}

function Split-HintItems {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HintType,
        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    $normalized = $Content.Trim()
    if ($HintType -eq "STARTER") {
        if ($normalized -match '"([^"]+)"') {
            return @($Matches[1].Trim())
        }
        return @($normalized)
    }

    if (($HintType -in @("VOCAB_WORD", "VOCAB_PHRASE", "LINKER")) -and $normalized.Contains(":")) {
        $payload = ($normalized -replace '^[^:]+:\s*', '')
        return $payload.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    }

    return @($normalized)
}

function Default-HintTitle {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HintType
    )

    switch ($HintType) {
        "STARTER" { return "첫 문장 스타터" }
        "VOCAB_WORD" { return "활용 단어" }
        "VOCAB_PHRASE" { return "활용 표현" }
        "STRUCTURE" { return "답변 구조" }
        "DETAIL" { return "추가 설명" }
        "LINKER" { return "연결 표현" }
        default { return $HintType }
    }
}

function Default-ItemType {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HintType
    )

    switch ($HintType) {
        "VOCAB_WORD" { return "WORD" }
        "VOCAB_PHRASE" { return "PHRASE" }
        "LINKER" { return "PHRASE" }
        default { return "FRAME" }
    }
}

$categories = @(
    @{
        Abbr = "rtn"
        PromptPrefix = "prompt-routine"
        Themes = @(
            @{
                Starter = '"On weekday mornings, I usually..."로 시작해 보세요.'
                Words = "활용 단어: wake up, get ready, breakfast, commute, schedule"
                Expressions = "활용 표현: on weekdays, in the morning, before work, right after I wake up"
                ExtraType = "STRUCTURE"
                Extra = "일어나는 시점, 주로 하는 일 2개, 마지막 준비를 순서대로 이어 보세요."
            },
            @{
                Starter = '"After work, I usually..."로 시작해 보세요.'
                Words = "활용 단어: relax, dinner, exercise, study, unwind"
                Expressions = "활용 표현: after work, in the evening, when I get home, before bed"
                ExtraType = "STRUCTURE"
                Extra = "집에 온 뒤 하는 일과 하루를 마무리하는 행동을 자연스럽게 연결해 보세요."
            },
            @{
                Starter = '"On Sunday afternoons, I usually..."로 시작해 보세요.'
                Words = "활용 단어: rest, cafe, read, meet friends, recharge"
                Expressions = "활용 표현: on Sunday afternoons, after lunch, in my free time, once in a while"
                ExtraType = "STRUCTURE"
                Extra = "여유 시간에 하는 활동과 그때 드는 기분을 함께 넣어 보세요."
            },
            @{
                Starter = '"When I have free time at home, I usually..."로 시작해 보세요.'
                Words = "활용 단어: stay home, watch shows, clean, cook, scroll"
                Expressions = "활용 표현: at home, in my free time, when I stay in, most of the time"
                ExtraType = "STRUCTURE"
                Extra = "집이라는 장소를 먼저 잡고, 그 안에서 하는 활동 2개를 이어 보세요."
            },
            @{
                Starter = '"I like to start my Saturday by..."로 시작해 보세요.'
                Words = "활용 단어: sleep in, brunch, jog, tidy up, plan"
                Expressions = "활용 표현: on Saturday mornings, to start my day, at the beginning of the weekend, before noon"
                ExtraType = "STRUCTURE"
                Extra = "토요일을 시작하는 첫 행동과 그다음 흐름을 순서대로 붙여 보세요."
            }
        )
    },
    @{
        Abbr = "pref"
        PromptPrefix = "prompt-preference"
        Themes = @(
            @{
                Starter = '"My favorite food is ... because..."로 시작해 보세요.'
                Words = "활용 단어: spicy, sweet, savory, comforting, delicious"
                Expressions = "활용 표현: my favorite food, because it tastes, one reason is, I especially like"
                ExtraType = "DETAIL"
                Extra = "맛, 느낌, 자주 먹는 상황 중 2가지를 넣으면 답변이 더 선명해져요."
            },
            @{
                Starter = '"My favorite movie genre is ... because..."로 시작해 보세요.'
                Words = "활용 단어: exciting, emotional, funny, suspenseful, relatable"
                Expressions = "활용 표현: my favorite genre, I enjoy it because, it keeps me, I like movies that"
                ExtraType = "DETAIL"
                Extra = "그 장르의 특징과 좋아하는 이유 2개를 짧게 이어 보세요."
            },
            @{
                Starter = '"My favorite place to relax is ... because..."로 시작해 보세요.'
                Words = "활용 단어: quiet, cozy, peaceful, calm, comfortable"
                Expressions = "활용 표현: when I want to relax, my favorite place is, it helps me, I feel calm there"
                ExtraType = "DETAIL"
                Extra = "장소의 분위기와 그곳에서 주로 하는 행동을 함께 넣어 보세요."
            },
            @{
                Starter = '"My favorite season is ... because..."로 시작해 보세요.'
                Words = "활용 단어: weather, breeze, sunshine, leaves, temperature"
                Expressions = "활용 표현: my favorite season, what I like most is, it feels, during that season"
                ExtraType = "DETAIL"
                Extra = "날씨와 그 계절이 주는 분위기를 함께 말하면 더 자연스러워요."
            },
            @{
                Starter = '"My favorite type of music is ... because..."로 시작해 보세요.'
                Words = "활용 단어: rhythm, melody, lyrics, relaxing, energetic"
                Expressions = "활용 표현: I listen to it when, my favorite kind of music, it makes me feel, one thing I like is"
                ExtraType = "DETAIL"
                Extra = "언제 듣는지와 어떤 느낌을 주는지 한 문장씩 덧붙여 보세요."
            }
        )
    },
    @{
        Abbr = "goal"
        PromptPrefix = "prompt-goal"
        Themes = @(
            @{
                Starter = '"One skill I want to improve this year is..."로 시작해 보세요.'
                Words = "활용 단어: improve, practice, focus, progress, confidence"
                Expressions = "활용 표현: this year, I want to improve, little by little, by practicing every day"
                ExtraType = "STRUCTURE"
                Extra = "목표, 실천 방법, 기대하는 변화를 순서대로 정리해 보세요."
            },
            @{
                Starter = '"One habit I want to build this year is..."로 시작해 보세요.'
                Words = "활용 단어: routine, consistency, habit, schedule, maintain"
                Expressions = "활용 표현: every day, every week, stick to it, make it a routine"
                ExtraType = "STRUCTURE"
                Extra = "얼마나 자주 할지와 그 습관을 유지할 방법을 함께 넣어 보세요."
            },
            @{
                Starter = '"One health goal I have this year is..."로 시작해 보세요.'
                Words = "활용 단어: exercise, sleep, diet, energy, healthy"
                Expressions = "활용 표현: to stay healthy, take care of myself, cut back on, work out regularly"
                ExtraType = "STRUCTURE"
                Extra = "건강 목표와 실천 방법 2개를 구체적으로 이어 보세요."
            },
            @{
                Starter = '"One language goal I have this year is..."로 시작해 보세요.'
                Words = "활용 단어: vocabulary, speaking, listening, fluency, practice"
                Expressions = "활용 표현: improve my English, practice every day, by using, little by little"
                ExtraType = "STRUCTURE"
                Extra = "어떤 영역을 늘리고 싶은지와 연습 루틴을 분명하게 적어 보세요."
            },
            @{
                Starter = '"One area where I want more confidence is..."로 시작해 보세요.'
                Words = "활용 단어: confidence, challenge, step, improvement, courage"
                Expressions = "활용 표현: step by step, get better at, push myself, become more comfortable with"
                ExtraType = "STRUCTURE"
                Extra = "부담되는 이유와 작게 시작할 방법을 함께 적으면 답변이 더 좋아져요."
            }
        )
    },
    @{
        Abbr = "prob"
        PromptPrefix = "prompt-problem"
        Themes = @(
            @{
                Starter = '"One challenge I often face with time management is..."로 시작해 보세요.'
                Words = "활용 단어: deadline, schedule, priority, delay, focus"
                Expressions = "활용 표현: run out of time, manage my schedule, stay on track, make a plan"
                ExtraType = "STRUCTURE"
                Extra = "문제 상황, 원인, 해결 방법 순서로 설명하면 흐름이 좋아져요."
            },
            @{
                Starter = '"One challenge I often face is staying motivated when..."로 시작해 보세요.'
                Words = "활용 단어: motivation, routine, distraction, energy, mindset"
                Expressions = "활용 표현: lose motivation, get back on track, keep going, remind myself why"
                ExtraType = "STRUCTURE"
                Extra = "의욕이 떨어지는 순간과 다시 시작하는 방법을 함께 써 보세요."
            },
            @{
                Starter = '"One challenge I have with public speaking is..."로 시작해 보세요.'
                Words = "활용 단어: nervous, audience, presentation, confidence, practice"
                Expressions = "활용 표현: speak in front of people, feel nervous, take a deep breath, prepare in advance"
                ExtraType = "STRUCTURE"
                Extra = "긴장 원인과 완화 방법을 각각 한 문장씩 적어 보세요."
            },
            @{
                Starter = '"One challenge I face with work-life balance is..."로 시작해 보세요.'
                Words = "활용 단어: balance, workload, rest, burnout, boundary"
                Expressions = "활용 표현: after work, make time for, take a break, set boundaries"
                ExtraType = "STRUCTURE"
                Extra = "일이 몰릴 때와 쉬는 시간을 지키는 방법을 연결해서 말해 보세요."
            },
            @{
                Starter = '"One challenge I sometimes face in teamwork is..."로 시작해 보세요.'
                Words = "활용 단어: teamwork, communication, conflict, role, cooperation"
                Expressions = "활용 표현: work as a team, share ideas, solve problems together, listen to each other"
                ExtraType = "STRUCTURE"
                Extra = "의견 차이나 갈등이 있었을 때 어떻게 풀었는지 한 줄 넣어 보세요."
            }
        )
    },
    @{
        Abbr = "bal"
        PromptPrefix = "prompt-balance"
        Themes = @(
            @{
                Starter = '"Social media has changed daily life in many ways."로 시작해 보세요.'
                Words = "활용 단어: connection, distraction, communication, influence, privacy"
                Expressions = "활용 표현: on the one hand, on the other hand, overall, in daily life"
                ExtraType = "LINKER"
                Extra = "연결 표현: on the one hand, on the other hand, however, overall"
            },
            @{
                Starter = '"Remote work has changed the way many people live and work."로 시작해 보세요.'
                Words = "활용 단어: flexibility, productivity, isolation, commute, balance"
                Expressions = "활용 표현: work from home, save time, stay connected, feel isolated"
                ExtraType = "LINKER"
                Extra = "연결 표현: for some people, however, at the same time, overall"
            },
            @{
                Starter = '"Artificial intelligence is changing education in noticeable ways."로 시작해 보세요.'
                Words = "활용 단어: learning, feedback, access, cheating, efficiency"
                Expressions = "활용 표현: in education, help students, raise concerns, at the same time"
                ExtraType = "LINKER"
                Extra = "연결 표현: on the positive side, however, for example, overall"
            },
            @{
                Starter = '"Online shopping has made daily life more convenient in many ways."로 시작해 보세요.'
                Words = "활용 단어: convenience, delivery, impulse buying, price, variety"
                Expressions = "활용 표현: buy things online, compare prices, save time, spend more than planned"
                ExtraType = "LINKER"
                Extra = "연결 표현: one advantage is, one drawback is, for instance, overall"
            },
            @{
                Starter = '"Smartphones play a huge role in daily life today."로 시작해 보세요.'
                Words = "활용 단어: convenience, screen time, communication, dependence, information"
                Expressions = "활용 표현: use my phone, stay connected, waste time, rely on technology"
                ExtraType = "LINKER"
                Extra = "연결 표현: on the one hand, still, because of this, in the end"
            }
        )
    },
    @{
        Abbr = "opin"
        PromptPrefix = "prompt-opinion"
        Themes = @(
            @{
                Starter = '"Successful companies should take responsibility for more than profit."로 시작해 보세요.'
                Words = "활용 단어: responsibility, fairness, employees, community, sustainability"
                Expressions = "활용 표현: in my opinion, should take responsibility for, not only ... but also, for example"
                ExtraType = "DETAIL"
                Extra = "이익 외에 누구에게 책임이 있는지 2가지 관점을 넣으면 더 설득력 있어요."
            },
            @{
                Starter = '"Public transportation in big cities should serve people efficiently and fairly."로 시작해 보세요.'
                Words = "활용 단어: access, congestion, safety, affordability, environment"
                Expressions = "활용 표현: in big cities, reduce traffic, be available to, make life easier"
                ExtraType = "DETAIL"
                Extra = "시민 생활, 환경, 비용 관점 중 2개를 골라 설명해 보세요."
            },
            @{
                Starter = '"Schools should teach financial skills because they matter in real life."로 시작해 보세요.'
                Words = "활용 단어: budget, saving, debt, planning, decision-making"
                Expressions = "활용 표현: in real life, learn how to, prepare students for, make smart choices"
                ExtraType = "DETAIL"
                Extra = "학생들에게 왜 필요한지 구체적인 상황과 함께 말해 보세요."
            },
            @{
                Starter = '"Volunteering in local communities can make a real difference."로 시작해 보세요.'
                Words = "활용 단어: community, support, participation, impact, belonging"
                Expressions = "활용 표현: give back to, help others, in the local community, make a difference"
                ExtraType = "DETAIL"
                Extra = "실제 예시 하나를 넣으면 주장에 힘이 더 실려요."
            },
            @{
                Starter = '"Social media platforms should take responsibility for what happens on their services."로 시작해 보세요.'
                Words = "활용 단어: platform, safety, misinformation, moderation, responsibility"
                Expressions = "활용 표현: protect users, spread false information, set clear rules, take action"
                ExtraType = "DETAIL"
                Extra = "사용자 보호와 표현의 자유 사이의 균형도 함께 언급해 보세요."
            }
        )
    },
    @{
        Abbr = "refl"
        PromptPrefix = "prompt-reflection"
        Themes = @(
            @{
                Starter = '"I used to think success meant one thing, but now I see it differently."로 시작해 보세요.'
                Words = "활용 단어: success, stability, happiness, achievement, balance"
                Expressions = "활용 표현: I used to think, but now, over time, I realized that"
                ExtraType = "STRUCTURE"
                Extra = "과거 기준, 현재 기준, 바뀐 이유를 순서대로 정리해 보세요."
            },
            @{
                Starter = '"My view of good study habits has changed over time."로 시작해 보세요.'
                Words = "활용 단어: consistency, focus, method, efficiency, review"
                Expressions = "활용 표현: at first, later on, I realized that, what works for me now"
                ExtraType = "STRUCTURE"
                Extra = "예전 방식과 지금 방식을 비교하고, 무엇이 계기였는지 적어 보세요."
            },
            @{
                Starter = '"My view of social media has changed a lot over time."로 시작해 보세요.'
                Words = "활용 단어: connection, pressure, comparison, information, boundary"
                Expressions = "활용 표현: at first, these days, I have learned to, change my perspective"
                ExtraType = "STRUCTURE"
                Extra = "좋다고 느꼈던 점과 조심하게 된 점을 함께 넣어 보세요."
            },
            @{
                Starter = '"My thoughts about money have changed as I have gotten older."로 시작해 보세요.'
                Words = "활용 단어: saving, spending, security, value, priority"
                Expressions = "활용 표현: when I was younger, now I think, be careful with, matter more to me"
                ExtraType = "STRUCTURE"
                Extra = "예전 소비 기준과 지금의 우선순위를 비교하면 답변이 더 분명해져요."
            },
            @{
                Starter = '"My understanding of leadership has changed through experience."로 시작해 보세요.'
                Words = "활용 단어: leadership, responsibility, listening, teamwork, trust"
                Expressions = "활용 표현: I used to believe, now I think, lead by example, listen to others"
                ExtraType = "STRUCTURE"
                Extra = "리더십을 어떻게 정의했는지 과거와 현재로 나눠 보세요."
            }
        )
    },
    @{
        Abbr = "gen"
        PromptPrefix = "prompt-general"
        Themes = @(
            @{
                Starter = '"One useful app I use often is..."로 시작해 보세요.'
                Words = "활용 단어: convenient, feature, organize, reminder, useful"
                Expressions = "활용 표현: I use it almost every day, what I like most is, it helps me, when I need to"
                ExtraType = "DETAIL"
                Extra = "무엇을 할 때 쓰는지와 편한 점을 같이 적어 보세요."
            },
            @{
                Starter = '"One place in my town that I like is..."로 시작해 보세요.'
                Words = "활용 단어: neighborhood, atmosphere, local, peaceful, familiar"
                Expressions = "활용 표현: in my town, not far from, I like going there because, it feels"
                ExtraType = "DETAIL"
                Extra = "장소 분위기와 왜 기억에 남는지 한 줄씩 덧붙여 보세요."
            },
            @{
                Starter = '"One teacher or mentor who influenced me is..."로 시작해 보세요.'
                Words = "활용 단어: guidance, advice, encouragement, influence, confidence"
                Expressions = "활용 표현: taught me how to, helped me, because of that person, I learned that"
                ExtraType = "DETAIL"
                Extra = "어떤 말이나 행동이 영향을 줬는지 하나만 구체적으로 넣어 보세요."
            },
            @{
                Starter = '"One hobby I would recommend to others is..."로 시작해 보세요.'
                Words = "활용 단어: relaxing, creative, rewarding, routine, enjoyable"
                Expressions = "활용 표현: I would recommend it because, a good way to, in your free time, easy to start"
                ExtraType = "DETAIL"
                Extra = "시작하기 쉬운 이유와 좋은 점 2개를 함께 적어 보세요."
            },
            @{
                Starter = '"One memory that still matters to me is..."로 시작해 보세요.'
                Words = "활용 단어: memorable, emotional, meaningful, unforgettable, special"
                Expressions = "활용 표현: I still remember, what stayed with me, ever since then, it means a lot to me"
                ExtraType = "DETAIL"
                Extra = "언제의 기억인지와 왜 오래 남았는지 감정과 함께 적어 보세요."
            }
        )
    }
)

$scriptRoot = if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) {
    $PSScriptRoot
} else {
    Join-Path (Get-Location) "scripts\db"
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $scriptRoot "..\..\infra\mysql\schema\014-seed-example-prompt-hints.sql"
}

$lines = New-Object System.Collections.Generic.List[string]

$lines.Add("-- Seed hint data for the 200 operational prompts.")
$lines.Add("")

foreach ($category in $categories) {
    $hintRows = New-Object System.Collections.Generic.List[string]
    $itemRows = New-Object System.Collections.Generic.List[string]

    for ($index = 1; $index -le 25; $index++) {
        $theme = $category.Themes[[math]::Floor(($index - 1) / 5)]
        $promptId = "{0}-{1:d2}" -f $category.PromptPrefix, $index
        $abbr = $category.Abbr

        $hints = @(
            @{ Id = ("hint-{0}-{1:d2}-1" -f $abbr, $index); Type = "STARTER"; Title = (Default-HintTitle "STARTER"); Content = $theme.Starter; Order = 1 },
            @{ Id = ("hint-{0}-{1:d2}-2" -f $abbr, $index); Type = "VOCAB_WORD"; Title = (Default-HintTitle "VOCAB_WORD"); Content = $theme.Words; Order = 2 },
            @{ Id = ("hint-{0}-{1:d2}-3" -f $abbr, $index); Type = "VOCAB_PHRASE"; Title = (Default-HintTitle "VOCAB_PHRASE"); Content = $theme.Expressions; Order = 3 },
            @{ Id = ("hint-{0}-{1:d2}-4" -f $abbr, $index); Type = $theme.ExtraType; Title = (Default-HintTitle $theme.ExtraType); Content = $theme.Extra; Order = 4 }
        )

        foreach ($hint in $hints) {
            $hintRows.Add([string]::Format(
                "    ('{0}', '{1}', '{2}', '{3}', {4}, TRUE)",
                (Escape-Sql $hint.Id),
                (Escape-Sql $promptId),
                (Escape-Sql $hint.Type),
                (Escape-Sql $hint.Title),
                $hint.Order
            ))

            $items = Split-HintItems -HintType $hint.Type -Content $hint.Content
            $itemType = Default-ItemType $hint.Type
            $itemOrder = 1
            foreach ($item in $items) {
                $itemRows.Add([string]::Format(
                    "    ('{0}', '{1}', '{2}', '{3}', {4}, TRUE)",
                    (Escape-Sql ("{0}-item-{1}" -f $hint.Id, $itemOrder)),
                    (Escape-Sql $hint.Id),
                    (Escape-Sql $itemType),
                    (Escape-Sql $item),
                    $itemOrder
                ))
                $itemOrder += 1
            }
        }
    }

    $lines.Add("INSERT INTO prompt_hints (")
    $lines.Add("    id,")
    $lines.Add("    prompt_id,")
    $lines.Add("    hint_type,")
    $lines.Add("    title,")
    $lines.Add("    display_order,")
    $lines.Add("    is_active")
    $lines.Add(")")
    $lines.Add("VALUES")
    $lines.Add(($hintRows -join ",`r`n"))
    $lines.Add("ON DUPLICATE KEY UPDATE")
    $lines.Add("    hint_type = VALUES(hint_type),")
    $lines.Add("    title = VALUES(title),")
    $lines.Add("    display_order = VALUES(display_order),")
    $lines.Add("    is_active = VALUES(is_active);")
    $lines.Add("")

    $lines.Add("INSERT INTO prompt_hint_items (")
    $lines.Add("    id,")
    $lines.Add("    hint_id,")
    $lines.Add("    item_type,")
    $lines.Add("    content,")
    $lines.Add("    display_order,")
    $lines.Add("    is_active")
    $lines.Add(")")
    $lines.Add("VALUES")
    $lines.Add(($itemRows -join ",`r`n"))
    $lines.Add("ON DUPLICATE KEY UPDATE")
    $lines.Add("    item_type = VALUES(item_type),")
    $lines.Add("    content = VALUES(content),")
    $lines.Add("    display_order = VALUES(display_order),")
    $lines.Add("    is_active = VALUES(is_active);")
    $lines.Add("")
}

$content = $lines -join "`r`n"
[System.IO.File]::WriteAllText(
    [System.IO.Path]::GetFullPath($OutputPath),
    $content,
    (New-Object System.Text.UTF8Encoding($false))
)
