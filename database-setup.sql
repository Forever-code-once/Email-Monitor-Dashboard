-- Azure SQL Database Setup Script for Email Monitor Dashboard
-- Run this script in your Azure SQL Database to create the necessary tables

-- Create TruckAvailability table
CREATE TABLE TruckAvailability (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Customer NVARCHAR(255) NOT NULL,
    CustomerEmail NVARCHAR(255) NOT NULL,
    Date NVARCHAR(50) NOT NULL,
    City NVARCHAR(100) NOT NULL,
    State NVARCHAR(50) NOT NULL,
    AdditionalInfo NVARCHAR(MAX) NULL,
    EmailId NVARCHAR(255) NOT NULL,
    EmailSubject NVARCHAR(500) NOT NULL,
    EmailDate DATETIME2 NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);

-- Create Emails table
CREATE TABLE Emails (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    EmailId NVARCHAR(255) NOT NULL UNIQUE,
    Subject NVARCHAR(500) NOT NULL,
    FromEmail NVARCHAR(255) NOT NULL,
    FromName NVARCHAR(255) NOT NULL,
    Body NTEXT NOT NULL,
    ReceivedDateTime DATETIME2 NOT NULL,
    IsForwarded BIT DEFAULT 0,
    OriginalSender NVARCHAR(255) NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);

-- Create Customers table
CREATE TABLE Customers (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CustomerName NVARCHAR(255) NOT NULL,
    CustomerEmail NVARCHAR(255) NOT NULL UNIQUE,
    FirstSeen DATETIME2 DEFAULT GETDATE(),
    LastSeen DATETIME2 DEFAULT GETDATE(),
    TotalEmails INT DEFAULT 0,
    TotalTrucks INT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);

-- Create indexes for better performance
CREATE INDEX IX_TruckAvailability_CustomerEmail ON TruckAvailability(CustomerEmail);
CREATE INDEX IX_TruckAvailability_Date ON TruckAvailability(Date);
CREATE INDEX IX_TruckAvailability_CityState ON TruckAvailability(City, State);
CREATE INDEX IX_TruckAvailability_EmailDate ON TruckAvailability(EmailDate);

CREATE INDEX IX_Emails_FromEmail ON Emails(FromEmail);
CREATE INDEX IX_Emails_ReceivedDateTime ON Emails(ReceivedDateTime);
CREATE INDEX IX_Emails_IsForwarded ON Emails(IsForwarded);

CREATE INDEX IX_Customers_CustomerEmail ON Customers(CustomerEmail);
CREATE INDEX IX_Customers_LastSeen ON Customers(LastSeen);

-- Create stored procedures for common operations

-- Stored procedure to save truck availability
CREATE PROCEDURE sp_SaveTruckAvailability
    @Customer NVARCHAR(255),
    @CustomerEmail NVARCHAR(255),
    @Date NVARCHAR(50),
    @City NVARCHAR(100),
    @State NVARCHAR(50),
    @AdditionalInfo NVARCHAR(MAX) = NULL,
    @EmailId NVARCHAR(255),
    @EmailSubject NVARCHAR(500),
    @EmailDate DATETIME2
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check if truck already exists (prevent duplicates)
    IF NOT EXISTS (
        SELECT 1 FROM TruckAvailability 
        WHERE CustomerEmail = @CustomerEmail 
        AND Date = @Date 
        AND City = @City 
        AND State = @State
        AND EmailId = @EmailId
    )
    BEGIN
        INSERT INTO TruckAvailability 
        (Customer, CustomerEmail, Date, City, State, AdditionalInfo, EmailId, EmailSubject, EmailDate)
        VALUES (@Customer, @CustomerEmail, @Date, @City, @State, @AdditionalInfo, @EmailId, @EmailSubject, @EmailDate);
        
        -- Update or insert customer record
        MERGE Customers AS target
        USING (SELECT @CustomerEmail, @Customer) AS source (CustomerEmail, CustomerName)
        ON target.CustomerEmail = source.CustomerEmail
        WHEN MATCHED THEN
            UPDATE SET 
                LastSeen = GETDATE(),
                TotalTrucks = (SELECT COUNT(*) FROM TruckAvailability WHERE CustomerEmail = @CustomerEmail),
                UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT (CustomerName, CustomerEmail, TotalTrucks)
            VALUES (source.CustomerName, source.CustomerEmail, 1);
    END
END;

-- Stored procedure to get truck availability by customer
CREATE PROCEDURE sp_GetTruckAvailabilityByCustomer
    @CustomerEmail NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        Id,
        Customer,
        CustomerEmail,
        Date,
        City,
        State,
        AdditionalInfo,
        EmailId,
        EmailSubject,
        EmailDate,
        CreatedAt
    FROM TruckAvailability 
    WHERE CustomerEmail = @CustomerEmail 
    ORDER BY EmailDate DESC;
END;

-- Stored procedure to get all truck availability with customer info
CREATE PROCEDURE sp_GetAllTruckAvailability
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        t.Id,
        t.Customer,
        t.CustomerEmail,
        t.Date,
        t.City,
        t.State,
        t.AdditionalInfo,
        t.EmailId,
        t.EmailSubject,
        t.EmailDate,
        t.CreatedAt,
        c.TotalEmails,
        c.FirstSeen,
        c.LastSeen
    FROM TruckAvailability t
    LEFT JOIN Customers c ON t.CustomerEmail = c.CustomerEmail
    ORDER BY t.EmailDate DESC;
END;

-- Stored procedure to save email
CREATE PROCEDURE sp_SaveEmail
    @EmailId NVARCHAR(255),
    @Subject NVARCHAR(500),
    @FromEmail NVARCHAR(255),
    @FromName NVARCHAR(255),
    @Body NTEXT,
    @ReceivedDateTime DATETIME2,
    @IsForwarded BIT = 0,
    @OriginalSender NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check if email already exists
    IF NOT EXISTS (SELECT 1 FROM Emails WHERE EmailId = @EmailId)
    BEGIN
        INSERT INTO Emails 
        (EmailId, Subject, FromEmail, FromName, Body, ReceivedDateTime, IsForwarded, OriginalSender)
        VALUES (@EmailId, @Subject, @FromEmail, @FromName, @Body, @ReceivedDateTime, @IsForwarded, @OriginalSender);
        
        -- Update customer email count
        UPDATE Customers 
        SET TotalEmails = TotalEmails + 1,
            LastSeen = GETDATE(),
            UpdatedAt = GETDATE()
        WHERE CustomerEmail = @FromEmail;
        
        -- If customer doesn't exist, create them
        IF @@ROWCOUNT = 0
        BEGIN
            INSERT INTO Customers (CustomerName, CustomerEmail, TotalEmails)
            VALUES (@FromName, @FromEmail, 1);
        END
    END
END;

-- Stored procedure to get customer statistics
CREATE PROCEDURE sp_GetCustomerStatistics
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        c.CustomerName,
        c.CustomerEmail,
        c.TotalEmails,
        c.TotalTrucks,
        c.FirstSeen,
        c.LastSeen,
        COUNT(t.Id) as CurrentTruckCount
    FROM Customers c
    LEFT JOIN TruckAvailability t ON c.CustomerEmail = t.CustomerEmail
    GROUP BY c.CustomerName, c.CustomerEmail, c.TotalEmails, c.TotalTrucks, c.FirstSeen, c.LastSeen
    ORDER BY c.LastSeen DESC;
END;

-- Create views for easier querying

-- View for recent truck availability
CREATE VIEW vw_RecentTruckAvailability AS
SELECT 
    t.*,
    c.TotalEmails,
    c.FirstSeen as CustomerFirstSeen
FROM TruckAvailability t
LEFT JOIN Customers c ON t.CustomerEmail = c.CustomerEmail
WHERE t.EmailDate >= DATEADD(day, -30, GETDATE()) -- Last 30 days
ORDER BY t.EmailDate DESC;

-- View for customer summary
CREATE VIEW vw_CustomerSummary AS
SELECT 
    c.CustomerName,
    c.CustomerEmail,
    c.TotalEmails,
    c.TotalTrucks,
    c.FirstSeen,
    c.LastSeen,
    COUNT(t.Id) as ActiveTrucks,
    MAX(t.EmailDate) as LatestTruckDate
FROM Customers c
LEFT JOIN TruckAvailability t ON c.CustomerEmail = t.CustomerEmail
GROUP BY c.CustomerName, c.CustomerEmail, c.TotalEmails, c.TotalTrucks, c.FirstSeen, c.LastSeen;

-- Sample data insertion (optional - for testing)
-- INSERT INTO Customers (CustomerName, CustomerEmail, TotalEmails, TotalTrucks)
-- VALUES ('Test Company', 'test@example.com', 5, 10);

-- INSERT INTO TruckAvailability (Customer, CustomerEmail, Date, City, State, EmailId, EmailSubject, EmailDate)
-- VALUES ('Test Company', 'test@example.com', '12/15', 'Atlanta', 'GA', 'test-email-1', 'Test Truck List', GETDATE()); 