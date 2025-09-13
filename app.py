from fastapi import FastAPI, Query
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow frontend (local + netlify) to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500", "https://ainternnn.netlify.app"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app = FastAPI()

# Example dataset (companies.csv)
# Company,Role,Degree,Language,Skills,Specialisation,Domain
df = pd.read_csv("companies.csv")

@app.get("/match")
def match_internships(
    title: str = "",
    degree: str = "",
    language: str = "",
    skill: str = "",
    specialisation: str = "",
    domain: str = ""
):
    results = []

    for _, row in df.iterrows():
        total_filters = 0
        matched_filters = 0
        matched_on = []

        # Title check
        if title:
            total_filters += 1
            if title.lower() in row["Role"].lower():
                matched_filters += 1
                matched_on.append("Title")

        # Degree check
        if degree:
            total_filters += 1
            if degree.lower() in str(row["Degree"]).lower():
                matched_filters += 1
                matched_on.append("Degree")

        # Language check
        if language:
            total_filters += 1
            if language.lower() in str(row["Language"]).lower():
                matched_filters += 1
                matched_on.append("Language")

        # Skill check
        if skill:
            total_filters += 1
            if skill.lower() in str(row["Skills"]).lower():
                matched_filters += 1
                matched_on.append("Skill")

        # Specialisation check
        if specialisation:
            total_filters += 1
            if specialisation.lower() in str(row["Specialisation"]).lower():
                matched_filters += 1
                matched_on.append("Specialisation")

        # Domain check
        if domain:
            total_filters += 1
            if domain.lower() in str(row["Domain"]).lower():
                matched_filters += 1
                matched_on.append("Domain")

        # Calculate percentage if filters were used
        if total_filters > 0:
            match_percent = int((matched_filters / total_filters) * 100)
        else:
            match_percent = 0

        if match_percent > 0:  # Only show internships with at least some match
            results.append({
                "Company": row["Company"],
                "Role": row["Role"],
                "MatchPercent": match_percent,
                "MatchedOn": matched_on
            })

    # Sort results by highest match %
    results = sorted(results, key=lambda x: x["MatchPercent"], reverse=True)
    if _name_ == "_main_":
     import uvicorn
     uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
    return {"Matches": results}