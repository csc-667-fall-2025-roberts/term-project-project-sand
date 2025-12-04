# TODO: Next Session

## Issues to Fix

### 1. Token Movement Around Board
- [ ] Fix token movement logic to ensure it goes around the board correctly
- [ ] Verify token doesn't disappear on side rows (positions 10-19 and 30-39)
- [ ] Ensure token lands on correct property number after dice roll
- [ ] Test token movement from all positions (especially corners and edges)

**Files to check:**
- `src/frontend/entrypoint.ts` - `moveTokenOnBoard()` function
- `src/backend/views/gameroom.ejs` - Board layout and positioning

### 2. Database Integration Verification
- [ ] Verify user accounts are actually being saved to database
- [ ] Test signup flow - check database after creating account
- [ ] Verify game creation saves to database
- [ ] Check that game participants are saved when joining
- [ ] Verify chat messages are saved to database
- [ ] Test property purchases are saved (ownerships table)
- [ ] Verify transactions are recorded in database

**How to test:**
- Use `node check-games.js` to see games in database
- Check pgAdmin or use SQL queries to verify data
- Add console.log statements in backend routes to confirm database writes
- Test each flow (signup, login, create game, join game, buy property, send chat)

**Files to check:**
- `src/backend/routes/auth.ts` - Signup/login routes
- `src/backend/routes/lobby.ts` - Game creation
- `src/backend/routes/gameroom.ts` - Join game, buy property, chat
- Database connection in `src/backend/server.ts`

## Additional Notes

- Make sure to test with actual database queries, not just UI feedback
- Check browser console for any errors during database operations
- Verify foreign key relationships are working correctly
- Test error handling when database operations fail

---

**Created:** End of Milestone 4 session
**Status:** Ready for next work session

