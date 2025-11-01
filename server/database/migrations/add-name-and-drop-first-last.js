const { DataTypes } = require('sequelize');

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.sequelize.transaction(async (t) => {
			// Describe table to check existing columns
			const table = await queryInterface.describeTable('clients');
			// 1) Add name column if missing
			if (!table.name) {
				await queryInterface.addColumn('clients', 'name', {
					type: DataTypes.STRING,
					allowNull: true
				}, { transaction: t });
			}
			// 2) Backfill name from firstName + lastName
			await queryInterface.sequelize.query(
				`UPDATE clients
				 SET name = TRIM(CONCAT(COALESCE(firstName, ''),
				   CASE
				     WHEN COALESCE(firstName, '') <> '' AND COALESCE(lastName, '') <> '' THEN ' '
				     ELSE ''
				   END,
				   COALESCE(lastName, '')))
				 WHERE (name IS NULL OR name = '')`,
				{ transaction: t }
			);
			// 3) Make name NOT NULL now that data is backfilled
			await queryInterface.changeColumn('clients', 'name', {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: ''
			}, { transaction: t });
			// 4) Drop indexes involving firstName/lastName (best-effort)
			try { await queryInterface.removeIndex('clients', ['firstName', 'lastName'], { transaction: t }); } catch {}
			// 5) Drop firstName/lastName if exist
			if (table.firstName) {
				await queryInterface.removeColumn('clients', 'firstName', { transaction: t });
			}
			if (table.lastName) {
				await queryInterface.removeColumn('clients', 'lastName', { transaction: t });
			}
			// 6) Add index on name for search/sort
			try { await queryInterface.addIndex('clients', ['name'], { transaction: t }); } catch {}
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.sequelize.transaction(async (t) => {
			const table = await queryInterface.describeTable('clients');
			// 1) Re-add firstName/lastName as nullable
			if (!table.firstName) {
				await queryInterface.addColumn('clients', 'firstName', { type: DataTypes.STRING, allowNull: true }, { transaction: t });
			}
			if (!table.lastName) {
				await queryInterface.addColumn('clients', 'lastName', { type: DataTypes.STRING, allowNull: true }, { transaction: t });
			}
			// 2) Split name into first token + remainder
			await queryInterface.sequelize.query(
				`UPDATE clients
				 SET firstName = TRIM(SUBSTRING_INDEX(name, ' ', 1)),
				     lastName = TRIM(SUBSTRING(name, LENGTH(SUBSTRING_INDEX(name, ' ', 1)) + 1))`,
				{ transaction: t }
			);
			// 3) Best-effort index
			try { await queryInterface.addIndex('clients', ['firstName', 'lastName'], { transaction: t }); } catch {}
			// 4) Keep name column (do not drop) to avoid data loss; make it nullable for compatibility
			await queryInterface.changeColumn('clients', 'name', { type: DataTypes.STRING, allowNull: true }, { transaction: t });
		});
	}
};


