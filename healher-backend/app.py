def calculate_period_score(data):
    score = 0

    # 1. Period Duration
    if data["duration"] == "2-5":
        score += 0
    elif data["duration"] == "6-7":
        score += 1
    elif data["duration"] == ">7":
        score += 2

    # 2. Cycle Regularity
    if data["regularity"] == "yes":
        score += 0
    elif data["regularity"] == "sometimes":
        score += 1
    elif data["regularity"] == "no":
        score += 2

    # 3. Missed Periods
    if data["missed"] == "no":
        score += 0
    elif data["missed"] == "yes":
        score += 2

    # 4. Flow Type
    if data["flow"] == "normal":
        score += 0
    elif data["flow"] == "light/heavy":
        score += 1

    # 5. Heavy Bleeding / Clots
    if data["clots"] == "no":
        score += 0
    elif data["clots"] == "yes":
        score += 1

    # 6. Pain Severity
    if data["pain"] == "mild":
        score += 0
    elif data["pain"] == "moderate":
        score += 1
    elif data["pain"] == "severe":
        score += 2

    # 7. Cycle Change (last 6 months)
    if data["cycle_change"] == "no":
        score += 0
    elif data["cycle_change"] == "yes":
        score += 1

    # 8. Diagnosed PCOD
    if data["pcod"] == "no" or data["pcod"] == "not_sure":
        score += 0
    elif data["pcod"] == "yes":
        score += 2

    return score