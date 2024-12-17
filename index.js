const express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")
const mysql = require('mysql2')
const { rateLimit } = require("express-rate-limit");
const ollama = require("ollama")


const app = express();
const PORT = 3000;


const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minutes
    limit: 15, // each IP can make up to 10 requests per `windowsMs` (5 minutes)
    standardHeaders: true, // add the `RateLimit-*` headers to the response
    legacyHeaders: false, // remove the `X-RateLimit-*` headers from the response
});

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "pmp_v2_org121"

})

app.use(bodyParser.json());
app.use(cors());

// api to get project list.........................
app.post("/api/getProject", (req, res) => {
    const { projectId, query } = req.body; // Extract projectId from request body
    // console.log("In Get Project API");

    // Input validation
    if (!projectId) {
        return res.status(400).json({ error: "Project ID is required." });
    }

    // Use a parameterized query to prevent SQL injection
    const sql = "WITH ProjectDetails AS (SELECT p.Pr_ID, p.Pr_Name, p.Pr_ProjectCode, p.Start_Date, p.Finish_Date, p.Pr_Budget, p.Pr_ScopeDes, p.Pr_MainDeliv, p.Pr_Desc, (SELECT GROUP_CONCAT(CONCAT('Name: ', m.MS_Name, ', Planned: ', IFNULL(m.MS_Plan, 'No Plan Date'), ', Actual: ', IFNULL(m.MS_Actual, 'Not Completed')) SEPARATOR '; ') FROM milestones m WHERE m.Pr_ID = p.Pr_ID) AS Milestones, (SELECT GROUP_CONCAT(CONCAT('Name: ', ca.CA_Name, ', Start: ', IFNULL(ca.CA_Start, 'N/A'), ', Finish: ', IFNULL(ca.CA_Finish, 'N/A'), ', Budget: ', IFNULL(FORMAT(ca.CA_BLCost, 2), 'N/A')) SEPARATOR '; ') FROM ca ca WHERE ca.Pr_ID = p.Pr_ID) AS CostAccounts, (SELECT COUNT(DISTINCT rr.RR_ID) FROM rr JOIN ca ON ca.CA_ID = rr.CA_ID WHERE ca.Pr_ID = p.Pr_ID) AS TotalRisks, (SELECT SUM(CASE WHEN rr.RR_Status = 'High Risk' THEN 1 ELSE 0 END) FROM rr JOIN ca ON ca.CA_ID = rr.CA_ID WHERE ca.Pr_ID = p.Pr_ID) AS HighRisks, (SELECT ROUND(SUM(ts.TimeSheet_Hours), 2) FROM timesheets ts JOIN ca ON ca.CA_ID = ts.CA_ID WHERE ca.Pr_ID = p.Pr_ID) AS TotalProjectHours, (SELECT COUNT(DISTINCT ts.TS_ID) FROM timesheets ts JOIN ca ON ca.CA_ID = ts.CA_ID WHERE ca.Pr_ID = p.Pr_ID) AS TimesheetEntries, (SELECT COUNT(DISTINCT t.Task_ID) FROM task t JOIN ca ON ca.CA_ID = t.CA_ID WHERE ca.Pr_ID = p.Pr_ID) AS TotalTasks, (SELECT SUM(CASE WHEN t.Task_State = 'Completed' THEN 1 ELSE 0 END) FROM task t JOIN ca ON ca.CA_ID = t.CA_ID WHERE ca.Pr_ID = p.Pr_ID) AS CompletedTasks, (SELECT ROUND(SUM(f.Fund_AmountBL), 2) FROM fund f WHERE f.Pr_ID = p.Pr_ID) AS TotalFundingPlanned, (SELECT ROUND(SUM(fr.FundRep_AmountActual), 2) FROM fund f JOIN fund_report fr ON f.Fund_ID = fr.Fund_ID WHERE f.Pr_ID = p.Pr_ID) AS TotalFundingActual FROM pr p) SELECT Pr_ID, Pr_Name, Pr_ProjectCode, Start_Date, Finish_Date, Pr_Budget, Pr_ScopeDes, Pr_MainDeliv, Pr_Desc, Milestones, CostAccounts, TotalRisks, HighRisks, TotalProjectHours, TimesheetEntries, TotalTasks, CompletedTasks, TotalFundingPlanned, TotalFundingActual, CASE WHEN TotalTasks > 0 THEN ROUND((CompletedTasks * 100.0 / TotalTasks), 2) ELSE 0 END AS TaskCompletionPercentage, CASE WHEN TotalFundingPlanned > 0 THEN ROUND((TotalFundingActual / TotalFundingPlanned * 100), 2) ELSE 0 END AS FundingUtilizationPercentage, DATEDIFF(Finish_Date, Start_Date) AS PlannedProjectDuration, CASE WHEN HighRisks > 0 THEN 'High Risk' WHEN TotalRisks > 0 THEN 'Moderate Risk' ELSE 'Low Risk' END AS OverallRiskLevel FROM ProjectDetails WHERE Pr_Id = ?";

    db.query(sql, [projectId], async (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        var response = await ollama.chat({
            model: 'llama3.2:1b',
            messages: [{ role: 'user', content: query }],
        });
        console.log(response);

        res.json(result);
    });
});


app.listen(PORT, () => {
    console.log("Server is running on port http://localhost:3000");
})