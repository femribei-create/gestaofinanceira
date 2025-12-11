CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`accountType` enum('bank','credit_card') NOT NULL,
	`businessType` enum('personal','business') NOT NULL,
	`initialBalance` int NOT NULL DEFAULT 0,
	`currentBalance` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cardClosingDates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accountId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`closingDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cardClosingDates_id` PRIMARY KEY(`id`),
	CONSTRAINT `cardClosingDates_unique` UNIQUE(`accountId`,`year`,`month`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`subcategory` varchar(255),
	`businessType` enum('personal','business') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classificationHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`description` text NOT NULL,
	`categoryId` int NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	`lastUsed` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classificationHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classificationRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`pattern` text NOT NULL,
	`matchType` enum('contains','starts_with','ends_with','exact') NOT NULL,
	`accountId` int,
	`categoryId` int NOT NULL,
	`transactionType` enum('income','expense') NOT NULL,
	`priority` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classificationRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monthlyGoals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`categoryId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`goalAmount` int NOT NULL,
	`alertSent70` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthlyGoals_id` PRIMARY KEY(`id`),
	CONSTRAINT `monthlyGoals_unique` UNIQUE(`userId`,`categoryId`,`year`,`month`)
);
--> statement-breakpoint
CREATE TABLE `revenueData` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`creditCash` int NOT NULL DEFAULT 0,
	`credit2x` int NOT NULL DEFAULT 0,
	`credit3x` int NOT NULL DEFAULT 0,
	`credit4x` int NOT NULL DEFAULT 0,
	`credit5x` int NOT NULL DEFAULT 0,
	`credit6x` int NOT NULL DEFAULT 0,
	`debit` int NOT NULL DEFAULT 0,
	`cash` int NOT NULL DEFAULT 0,
	`pix` int NOT NULL DEFAULT 0,
	`giraCredit` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenueData_id` PRIMARY KEY(`id`),
	CONSTRAINT `revenueData_unique` UNIQUE(`userId`,`year`,`month`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accountId` int NOT NULL,
	`categoryId` int,
	`description` text NOT NULL,
	`amount` int NOT NULL,
	`transactionType` enum('income','expense') NOT NULL,
	`purchaseDate` timestamp NOT NULL,
	`paymentDate` timestamp NOT NULL,
	`isInstallment` boolean NOT NULL DEFAULT false,
	`installmentNumber` int,
	`installmentTotal` int,
	`originalPurchaseDate` timestamp,
	`source` enum('manual','csv','ofx') NOT NULL,
	`sourceFile` varchar(255),
	`suggestedCategoryId` int,
	`classificationMethod` enum('rule','ai','manual','history'),
	`isDuplicate` boolean NOT NULL DEFAULT false,
	`duplicateStatus` enum('pending','approved','rejected') DEFAULT 'pending',
	`fitId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cardClosingDates` ADD CONSTRAINT `cardClosingDates_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cardClosingDates` ADD CONSTRAINT `cardClosingDates_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classificationHistory` ADD CONSTRAINT `classificationHistory_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classificationHistory` ADD CONSTRAINT `classificationHistory_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classificationRules` ADD CONSTRAINT `classificationRules_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classificationRules` ADD CONSTRAINT `classificationRules_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classificationRules` ADD CONSTRAINT `classificationRules_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monthlyGoals` ADD CONSTRAINT `monthlyGoals_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monthlyGoals` ADD CONSTRAINT `monthlyGoals_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revenueData` ADD CONSTRAINT `revenueData_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_suggestedCategoryId_categories_id_fk` FOREIGN KEY (`suggestedCategoryId`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `accounts_userId_idx` ON `accounts` (`userId`);--> statement-breakpoint
CREATE INDEX `cardClosingDates_userId_idx` ON `cardClosingDates` (`userId`);--> statement-breakpoint
CREATE INDEX `cardClosingDates_accountId_idx` ON `cardClosingDates` (`accountId`);--> statement-breakpoint
CREATE INDEX `cardClosingDates_yearMonth_idx` ON `cardClosingDates` (`year`,`month`);--> statement-breakpoint
CREATE INDEX `categories_userId_idx` ON `categories` (`userId`);--> statement-breakpoint
CREATE INDEX `categories_name_idx` ON `categories` (`name`);--> statement-breakpoint
CREATE INDEX `classificationHistory_userId_idx` ON `classificationHistory` (`userId`);--> statement-breakpoint
CREATE INDEX `classificationRules_userId_idx` ON `classificationRules` (`userId`);--> statement-breakpoint
CREATE INDEX `classificationRules_priority_idx` ON `classificationRules` (`priority`);--> statement-breakpoint
CREATE INDEX `monthlyGoals_userId_idx` ON `monthlyGoals` (`userId`);--> statement-breakpoint
CREATE INDEX `monthlyGoals_yearMonth_idx` ON `monthlyGoals` (`year`,`month`);--> statement-breakpoint
CREATE INDEX `revenueData_userId_idx` ON `revenueData` (`userId`);--> statement-breakpoint
CREATE INDEX `revenueData_yearMonth_idx` ON `revenueData` (`year`,`month`);--> statement-breakpoint
CREATE INDEX `transactions_userId_idx` ON `transactions` (`userId`);--> statement-breakpoint
CREATE INDEX `transactions_accountId_idx` ON `transactions` (`accountId`);--> statement-breakpoint
CREATE INDEX `transactions_categoryId_idx` ON `transactions` (`categoryId`);--> statement-breakpoint
CREATE INDEX `transactions_purchaseDate_idx` ON `transactions` (`purchaseDate`);--> statement-breakpoint
CREATE INDEX `transactions_paymentDate_idx` ON `transactions` (`paymentDate`);--> statement-breakpoint
CREATE INDEX `transactions_isDuplicate_idx` ON `transactions` (`isDuplicate`);--> statement-breakpoint
CREATE INDEX `transactions_fitId_idx` ON `transactions` (`fitId`);