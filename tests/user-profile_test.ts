import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals } from 'https://deno.land/std@0.170.0/testing/asserts.ts';

const CONTRACT_NAME = 'user-profile';

Clarinet.test({
  name: "UserProfile: Successfully create a profile with valid data",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;

    const block = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'create-profile', 
        [
          types.ascii('johndoe'),
          types.buff(Buffer.from('test-email-hash')), 
          types.uint(1)
        ], 
        user1.address
      )
    ]);

    // Verify transaction success
    block.receipts[0].result.expectOk().expectBool(true);

    // Verify profile exists
    const profileResult = chain.callReadOnlyFn(
      CONTRACT_NAME, 
      'get-user-profile', 
      [types.principal(user1.address)], 
      deployer.address
    );

    // Assert profile details
    profileResult.result.expectSome();
    const profileData = profileResult.result.expectTuple();
    assertEquals(profileData.username, 'johndoe');
    assertEquals(profileData['skill-level'], 1n);
    assertEquals(profileData.achievements, []);
  }
});

Clarinet.test({
  name: "UserProfile: Prevent creating multiple profiles for same user",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user1 = accounts.get('wallet_1')!;

    const block = chain.mineBlock([
      // First profile creation
      Tx.contractCall(CONTRACT_NAME, 'create-profile', 
        [
          types.ascii('johndoe'),
          types.buff(Buffer.from('test-email-hash')), 
          types.uint(1)
        ], 
        user1.address
      ),
      // Second profile creation attempt
      Tx.contractCall(CONTRACT_NAME, 'create-profile', 
        [
          types.ascii('johndoe2'),
          types.buff(Buffer.from('another-email-hash')), 
          types.uint(2)
        ], 
        user1.address
      )
    ]);

    // First transaction should succeed
    block.receipts[0].result.expectOk().expectBool(true);

    // Second transaction should fail with profile exists error
    block.receipts[1].result.expectErr().expectUint(402);
  }
});

Clarinet.test({
  name: "UserProfile: Validate username input constraints",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user1 = accounts.get('wallet_1')!;

    // Test empty username
    const emptyUsernameBlock = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'create-profile', 
        [
          types.ascii(''),
          types.buff(Buffer.from('test-email-hash')), 
          types.uint(1)
        ], 
        user1.address
      )
    ]);
    emptyUsernameBlock.receipts[0].result.expectErr().expectUint(405);

    // Test username too long
    const longUsernameBlock = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'create-profile', 
        [
          types.ascii('a'.repeat(51)),
          types.buff(Buffer.from('test-email-hash')), 
          types.uint(1)
        ], 
        user1.address
      )
    ]);
    longUsernameBlock.receipts[0].result.expectErr().expectUint(405);
  }
});

Clarinet.test({
  name: "UserProfile: Prevent duplicate username",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user1 = accounts.get('wallet_1')!;
    const user2 = accounts.get('wallet_2')!;

    const block = chain.mineBlock([
      // First user creates profile
      Tx.contractCall(CONTRACT_NAME, 'create-profile', 
        [
          types.ascii('johndoe'),
          types.buff(Buffer.from('test-email-hash')), 
          types.uint(1)
        ], 
        user1.address
      ),
      // Second user tries to use same username
      Tx.contractCall(CONTRACT_NAME, 'create-profile', 
        [
          types.ascii('johndoe'),
          types.buff(Buffer.from('another-email-hash')), 
          types.uint(2)
        ], 
        user2.address
      )
    ]);

    // First transaction should succeed
    block.receipts[0].result.expectOk().expectBool(true);

    // Second transaction should fail (username taken)
    block.receipts[1].result.expectErr().expectUint(405);
  }
});

Clarinet.test({
  name: "UserProfile: Read profile successfully",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const user1 = accounts.get('wallet_1')!;

    // Create profile
    const createBlock = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'create-profile', 
        [
          types.ascii('johndoe'),
          types.buff(Buffer.from('test-email-hash')), 
          types.uint(5)
        ], 
        user1.address
      )
    ]);
    createBlock.receipts[0].result.expectOk().expectBool(true);

    // Read profile
    const profileResult = chain.callReadOnlyFn(
      CONTRACT_NAME, 
      'get-user-profile', 
      [types.principal(user1.address)], 
      deployer.address
    );

    // Verify profile details
    profileResult.result.expectSome();
    const profileData = profileResult.result.expectTuple();
    assertEquals(profileData.username, 'johndoe');
    assertEquals(profileData['skill-level'], 5n);
    assertEquals(profileData.achievements, []);
  }
});

Clarinet.test({
  name: "UserProfile: Profile update functionality",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user1 = accounts.get('wallet_1')!;

    // Create profile
    const createBlock = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'create-profile', 
        [
          types.ascii('johndoe'),
          types.buff(Buffer.from('test-email-hash')), 
          types.uint(5)
        ], 
        user1.address
      )
    ]);
    createBlock.receipts[0].result.expectOk().expectBool(true);

    // Update profile
    const updateBlock = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'update-profile', 
        [
          types.some(types.buff(Buffer.from('new-email-hash'))),
          types.some(types.uint(10))
        ], 
        user1.address
      )
    ]);
    updateBlock.receipts[0].result.expectOk().expectBool(true);
  }
});

Clarinet.test({
  name: "UserProfile: Add and remove achievements",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user1 = accounts.get('wallet_1')!;

    // Create profile
    const createBlock = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'create-profile', 
        [
          types.ascii('johndoe'),
          types.buff(Buffer.from('test-email-hash')), 
          types.uint(5)
        ], 
        user1.address
      )
    ]);
    createBlock.receipts[0].result.expectOk().expectBool(true);

    // Add achievements
    const achievementBlock = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'add-achievement', 
        [types.ascii('first-achievement')], 
        user1.address
      ),
      Tx.contractCall(CONTRACT_NAME, 'add-achievement', 
        [types.ascii('second-achievement')], 
        user1.address
      )
    ]);
    achievementBlock.receipts[0].result.expectOk().expectBool(true);
    achievementBlock.receipts[1].result.expectOk().expectBool(true);

    // Remove achievement
    const removeBlock = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'remove-achievement', 
        [types.ascii('first-achievement')], 
        user1.address
      )
    ]);
    removeBlock.receipts[0].result.expectOk().expectBool(true);
  }
});

Clarinet.test({
  name: "UserProfile: Prevent exceeding max achievements",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const user1 = accounts.get('wallet_1')!;

    // Create profile
    const createBlock = chain.mineBlock([
      Tx.contractCall(CONTRACT_NAME, 'create-profile', 
        [
          types.ascii('johndoe'),
          types.buff(Buffer.from('test-email-hash')), 
          types.uint(5)
        ], 
        user1.address
      )
    ]);
    createBlock.receipts[0].result.expectOk().expectBool(true);

    // Add maximum achievements
    const achievementBlock = chain.mineBlock(
      Array(11).fill(0).map((_, index) => 
        Tx.contractCall(CONTRACT_NAME, 'add-achievement', 
          [types.ascii(`achievement-${index}`)], 
          user1.address
        )
      )
    );

    // Last achievement addition should fail
    achievementBlock.receipts[10].result.expectErr().expectUint(406);
  }
});